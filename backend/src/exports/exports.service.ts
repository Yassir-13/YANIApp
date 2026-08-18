import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Workbook, Worksheet } from 'exceljs';
import {
  format,
  fromZonedTime,
  getTimezoneOffset,
  toZonedTime,
} from 'date-fns-tz';
import { AppointmentStatus, OrderStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ExportAppointmentsQueryDto,
  ExportOrdersQueryDto,
  ExportRangeDto,
  ExportUsersQueryDto,
} from './dto/export-query.dto';

// Le fichier est lu par la gérante, pas par un développeur : aucune valeur
// d'énumération brute n'y apparaît.
const ROLE_LABEL: Record<Role, string> = {
  CLIENT: 'Cliente',
  STAFF: 'Personnel',
  ADMIN: 'Administratrice',
};

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  READY: 'Prête',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
};

const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmé',
  COMPLETED: 'Terminé',
  CANCELLED: 'Annulé',
};

// Formats de cellule Excel. Le montant reste un NOMBRE (« 320 » et non
// « 320,00 dh ») : seul l'affichage porte l'unité, si bien qu'une somme ou un
// tableau croisé fonctionne toujours dans le classeur.
const MONTANT = '#,##0.00" dh"';
const DATE_HEURE = 'dd/mm/yyyy hh:mm';
const DATE_SEULE = 'dd/mm/yyyy';

const OR = 'FFF3E7CE'; // fond des en-têtes, rappel du doré du backoffice

interface Colonne {
  titre: string;
  largeur: number;
  format?: string;
}

type Cellule = string | number | Date | null;

interface Total {
  label: string;
  valeur: string | number;
  format?: string;
}

@Injectable()
export class ExportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ─────────────────────────────────────────
  //  Clientes
  // ─────────────────────────────────────────
  async users(query: ExportUsersQueryDto) {
    const periode = this.bornes(query);
    const where: Prisma.UserWhereInput = {
      // Les comptes supprimés sont des coquilles anonymisées
      // (supprime-…@compte-supprime.invalid) : les exporter remplirait le
      // fichier de lignes vides sans nom ni téléphone.
      deletedAt: null,
      ...(query.role ? { role: query.role } : {}),
      ...(periode ? { createdAt: periode } : {}),
    };

    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        emailVerifiedAt: true,
      },
    });

    const wb = this.nouveauClasseur();
    const colonnes: Colonne[] = [
      { titre: 'Prénom', largeur: 18 },
      { titre: 'Nom', largeur: 18 },
      { titre: 'Email', largeur: 32 },
      { titre: 'Téléphone', largeur: 16 },
      { titre: 'Rôle', largeur: 16 },
      { titre: 'Inscrite le', largeur: 14, format: DATE_SEULE },
      { titre: 'Email vérifié', largeur: 14 },
    ];

    const lignes: Cellule[][] = users.map((u) => [
      u.firstName ?? '',
      u.lastName ?? '',
      u.email,
      u.phone ?? '',
      ROLE_LABEL[u.role],
      this.pourExcel(u.createdAt),
      u.emailVerifiedAt ? 'Oui' : 'Non',
    ]);

    const parRole = (r: Role) => users.filter((u) => u.role === r).length;
    this.feuille(wb, 'Clientes', 'Comptes', query, colonnes, lignes, [
      { label: 'Comptes exportés', valeur: users.length },
      { label: 'dont clientes', valeur: parRole(Role.CLIENT) },
      {
        label: 'dont personnel',
        valeur: parRole(Role.STAFF) + parRole(Role.ADMIN),
      },
      {
        label: 'Emails vérifiés',
        valeur: users.filter((u) => u.emailVerifiedAt).length,
      },
    ]);

    return this.fichier(wb, 'clientes', query);
  }

  // ─────────────────────────────────────────
  //  Commandes + produits vendus
  // ─────────────────────────────────────────
  async orders(query: ExportOrdersQueryDto) {
    const periode = this.bornes(query);
    const where: Prisma.OrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(periode ? { createdAt: periode } : {}),
    };

    const orders = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        items: { include: { product: { include: { category: true } } } },
        user: {
          select: { firstName: true, lastName: true, phone: true, email: true },
        },
      },
    });

    const wb = this.nouveauClasseur();

    // ── Feuille 1 : une ligne par commande ──
    const colonnes: Colonne[] = [
      { titre: 'Date', largeur: 17, format: DATE_HEURE },
      { titre: 'Cliente', largeur: 24 },
      { titre: 'Téléphone', largeur: 16 },
      { titre: 'Email', largeur: 30 },
      { titre: 'Mode', largeur: 12 },
      { titre: 'Articles', largeur: 40 },
      { titre: 'Quantité', largeur: 10 },
      { titre: 'Statut', largeur: 14 },
      { titre: 'Montant', largeur: 14, format: MONTANT },
    ];

    const lignes: Cellule[][] = orders.map((o) => [
      this.pourExcel(o.createdAt),
      this.nomComplet(o.user),
      o.user?.phone ?? '',
      o.user?.email ?? '',
      o.fulfillment === 'PICKUP' ? 'Retrait' : 'Livraison',
      o.items.map((i) => `${i.quantity}× ${i.product.name}`).join(', '),
      o.items.reduce((n, i) => n + i.quantity, 0),
      ORDER_STATUS_LABEL[o.status],
      o.total.toNumber(),
    ]);

    const terminees = orders.filter((o) => o.status === OrderStatus.COMPLETED);
    const annulees = orders.filter((o) => o.status === OrderStatus.CANCELLED);
    this.feuille(wb, 'Commandes', 'Commandes', query, colonnes, lignes, [
      { label: 'Commandes exportées', valeur: orders.length },
      {
        label: 'Montant cumulé des lignes ci-dessus',
        valeur: this.somme(orders),
        format: MONTANT,
      },
      {
        label: `Encaissé — commandes terminées (${terminees.length})`,
        valeur: this.somme(terminees),
        format: MONTANT,
      },
      {
        label: `Perdu — commandes annulées (${annulees.length})`,
        valeur: this.somme(annulees),
        format: MONTANT,
      },
    ]);

    // ── Feuille 2 : ce qui est réellement parti, produit par produit ──
    //
    // Toujours calculée sur les commandes TERMINÉES, même si la première
    // feuille montre un autre statut : une commande annulée n'a rien vendu, et
    // une commande en attente n'a encore rien vendu non plus.
    const vendus = await this.prisma.orderItem.findMany({
      where: {
        order: {
          status: OrderStatus.COMPLETED,
          ...(periode ? { createdAt: periode } : {}),
        },
      },
      include: { product: { include: { category: true } } },
    });

    const parProduit = new Map<
      string,
      { nom: string; categorie: string; quantite: number; ca: Prisma.Decimal }
    >();
    for (const item of vendus) {
      const cumul = parProduit.get(item.productId) ?? {
        nom: item.product.name,
        categorie: item.product.category.name,
        quantite: 0,
        ca: new Prisma.Decimal(0),
      };
      cumul.quantite += item.quantity;
      cumul.ca = cumul.ca.plus(item.unitPrice.mul(item.quantity));
      parProduit.set(item.productId, cumul);
    }

    const produits = [...parProduit.values()].sort((a, b) =>
      b.ca.comparedTo(a.ca),
    );
    const caProduits = produits.reduce(
      (t, p) => t.plus(p.ca),
      new Prisma.Decimal(0),
    );

    this.feuille(
      wb,
      'Produits vendus',
      'Produits vendus (commandes terminées)',
      query,
      [
        { titre: 'Produit', largeur: 34 },
        { titre: 'Catégorie', largeur: 22 },
        { titre: 'Quantité vendue', largeur: 16 },
        { titre: "Chiffre d'affaires", largeur: 18, format: MONTANT },
      ],
      produits.map((p) => [p.nom, p.categorie, p.quantite, p.ca.toNumber()]),
      [
        { label: 'Produits différents vendus', valeur: produits.length },
        {
          label: 'Unités vendues',
          valeur: produits.reduce((n, p) => n + p.quantite, 0),
        },
        {
          label: "Chiffre d'affaires produits",
          valeur: caProduits.toNumber(),
          format: MONTANT,
        },
      ],
    );

    return this.fichier(wb, 'commandes', query);
  }

  // ─────────────────────────────────────────
  //  Rendez-vous + services payés
  // ─────────────────────────────────────────
  async appointments(query: ExportAppointmentsQueryDto) {
    const periode = this.bornes(query);
    // Le filtre porte sur `startAt`, le jour de la prestation — et non sur la
    // date de réservation : un rendez-vous d'août réservé en juillet appartient
    // au bilan d'août.
    const where: Prisma.AppointmentWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(periode ? { startAt: periode } : {}),
    };

    const appointments = await this.prisma.appointment.findMany({
      where,
      orderBy: { startAt: 'asc' },
      include: {
        service: { include: { category: true } },
        user: {
          select: { firstName: true, lastName: true, phone: true, email: true },
        },
      },
    });

    // Prix facturé = celui annoncé à la cliente lors de la réservation. Le
    // tarif courant ne sert que pour les rendez-vous antérieurs à ce champ.
    const prix = (a: (typeof appointments)[number]) =>
      a.priceAtBooking ?? a.service.price;

    const wb = this.nouveauClasseur();

    const colonnes: Colonne[] = [
      { titre: 'Date & heure', largeur: 17, format: DATE_HEURE },
      { titre: 'Cliente', largeur: 24 },
      { titre: 'Téléphone', largeur: 16 },
      { titre: 'Prestation', largeur: 30 },
      { titre: 'Catégorie', largeur: 20 },
      { titre: 'Durée (min)', largeur: 12 },
      { titre: 'Statut', largeur: 14 },
      { titre: 'Prix', largeur: 14, format: MONTANT },
    ];

    const lignes: Cellule[][] = appointments.map((a) => [
      this.pourExcel(a.startAt),
      this.nomComplet(a.user),
      a.user?.phone ?? '',
      a.service.name,
      a.service.category.name,
      a.service.durationMin,
      APPOINTMENT_STATUS_LABEL[a.status],
      prix(a).toNumber(),
    ]);

    const cumule = (liste: typeof appointments) =>
      liste.reduce((t, a) => t.plus(prix(a)), new Prisma.Decimal(0)).toNumber();

    const termines = appointments.filter(
      (a) => a.status === AppointmentStatus.COMPLETED,
    );
    const annules = appointments.filter(
      (a) => a.status === AppointmentStatus.CANCELLED,
    );

    this.feuille(wb, 'Rendez-vous', 'Rendez-vous', query, colonnes, lignes, [
      { label: 'Rendez-vous exportés', valeur: appointments.length },
      {
        label: 'Montant cumulé des lignes ci-dessus',
        valeur: cumule(appointments),
        format: MONTANT,
      },
      {
        label: `Encaissé — rendez-vous terminés (${termines.length})`,
        valeur: cumule(termines),
        format: MONTANT,
      },
      {
        label: `Perdu — rendez-vous annulés (${annules.length})`,
        valeur: cumule(annules),
        format: MONTANT,
      },
    ]);

    // ── Feuille 2 : prestation par prestation, sur les rendez-vous honorés ──
    const parService = new Map<
      string,
      { nom: string; categorie: string; nombre: number; ca: Prisma.Decimal }
    >();
    for (const a of await this.prisma.appointment.findMany({
      where: {
        status: AppointmentStatus.COMPLETED,
        ...(periode ? { startAt: periode } : {}),
      },
      include: { service: { include: { category: true } } },
    })) {
      const cumul = parService.get(a.serviceId) ?? {
        nom: a.service.name,
        categorie: a.service.category.name,
        nombre: 0,
        ca: new Prisma.Decimal(0),
      };
      cumul.nombre += 1;
      cumul.ca = cumul.ca.plus(a.priceAtBooking ?? a.service.price);
      parService.set(a.serviceId, cumul);
    }

    const services = [...parService.values()].sort((a, b) =>
      b.ca.comparedTo(a.ca),
    );
    const caServices = services.reduce(
      (t, s) => t.plus(s.ca),
      new Prisma.Decimal(0),
    );

    this.feuille(
      wb,
      'Services payés',
      'Services payés (rendez-vous terminés)',
      query,
      [
        { titre: 'Prestation', largeur: 34 },
        { titre: 'Catégorie', largeur: 22 },
        { titre: 'Rendez-vous', largeur: 14 },
        { titre: "Chiffre d'affaires", largeur: 18, format: MONTANT },
      ],
      services.map((s) => [s.nom, s.categorie, s.nombre, s.ca.toNumber()]),
      [
        { label: 'Prestations différentes réalisées', valeur: services.length },
        {
          label: 'Rendez-vous honorés',
          valeur: services.reduce((n, s) => n + s.nombre, 0),
        },
        {
          label: "Chiffre d'affaires prestations",
          valeur: caServices.toNumber(),
          format: MONTANT,
        },
      ],
    );

    return this.fichier(wb, 'rendez-vous', query);
  }

  // ─────────────────────────────────────────
  //  Fuseau horaire et période
  // ─────────────────────────────────────────

  private get timezone(): string {
    return this.config.get<string>('CENTER_TIMEZONE') ?? 'Africa/Casablanca';
  }

  // « du 2026-08-01 au 2026-08-31 » traduit en instants, bornes incluses.
  private bornes(query: ExportRangeDto): Prisma.DateTimeFilter | undefined {
    const { from, to } = query;
    if (!from && !to) return undefined;
    return {
      ...(from
        ? { gte: fromZonedTime(`${from}T00:00:00`, this.timezone) }
        : {}),
      ...(to
        ? { lte: fromZonedTime(`${to}T23:59:59.999`, this.timezone) }
        : {}),
    };
  }

  private libellePeriode(query: ExportRangeDto): string {
    // « 2026-08-01 » → « 01/08/2026 », sans passer par un objet Date : la borne
    // est déjà un jour du centre, la reconvertir ne pourrait que la décaler.
    const jour = (d: string) => d.split('-').reverse().join('/');
    if (query.from && query.to)
      return `Du ${jour(query.from)} au ${jour(query.to)}`;
    if (query.from) return `À partir du ${jour(query.from)}`;
    if (query.to) return `Jusqu'au ${jour(query.to)}`;
    return "Depuis l'ouverture";
  }

  // Excel ignore les fuseaux : il affiche telle quelle l'heure qu'on lui donne.
  // Un rendez-vous stocké à 09:00 UTC s'afficherait donc « 09:00 » alors que la
  // cliente est attendue à 10:00 à Casablanca. On décale l'instant de l'écart
  // du fuseau du centre CE JOUR-LÀ (la base IANA gère le Ramadan, pendant lequel
  // le Maroc repasse à UTC+0) pour que la cellule porte l'heure de l'institut.
  private pourExcel(d: Date): Date {
    return new Date(d.getTime() + getTimezoneOffset(this.timezone, d));
  }

  private maintenantAuCentre(): string {
    return format(toZonedTime(new Date(), this.timezone), 'yyyy-MM-dd', {
      timeZone: this.timezone,
    });
  }

  // ─────────────────────────────────────────
  //  Fabrication du classeur
  // ─────────────────────────────────────────

  private nouveauClasseur(): Workbook {
    const wb = new Workbook();
    wb.creator = 'Yani Concept by Fati';
    wb.created = new Date();
    return wb;
  }

  private nomComplet(
    u?: { firstName: string | null; lastName: string | null } | null,
  ): string {
    return `${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim();
  }

  private somme(orders: { total: Prisma.Decimal }[]): number {
    return orders
      .reduce((t, o) => t.plus(o.total), new Prisma.Decimal(0))
      .toNumber();
  }

  // Une feuille : titre, période, tableau filtrable, puis bloc de totaux séparé
  // du tableau par une ligne vide — sinon le filtre d'Excel avalerait les
  // totaux comme s'ils étaient une ligne de données.
  private feuille(
    wb: Workbook,
    nom: string,
    titre: string,
    query: ExportRangeDto,
    colonnes: Colonne[],
    lignes: Cellule[][],
    totaux: Total[],
  ): Worksheet {
    const ws = wb.addWorksheet(nom);

    ws.mergeCells(1, 1, 1, colonnes.length);
    const cellTitre = ws.getCell(1, 1);
    cellTitre.value = titre;
    cellTitre.font = { bold: true, size: 14 };

    ws.mergeCells(2, 1, 2, colonnes.length);
    const cellPeriode = ws.getCell(2, 1);
    cellPeriode.value = this.libellePeriode(query);
    cellPeriode.font = { size: 11, color: { argb: 'FF7A7167' } };

    const LIGNE_ENTETE = 4;
    const entete = ws.getRow(LIGNE_ENTETE);
    colonnes.forEach((c, i) => {
      ws.getColumn(i + 1).width = c.largeur;
      const cell = entete.getCell(i + 1);
      cell.value = c.titre;
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: OR } };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFD9C9A3' } } };
    });

    lignes.forEach((ligne, index) => {
      const row = ws.getRow(LIGNE_ENTETE + 1 + index);
      ligne.forEach((valeur, i) => {
        const cell = row.getCell(i + 1);
        cell.value = valeur;
        if (colonnes[i].format) cell.numFmt = colonnes[i].format;
      });
    });

    // Le filtre ne couvre que l'en-tête et les données : jamais les totaux.
    ws.autoFilter = {
      from: { row: LIGNE_ENTETE, column: 1 },
      to: { row: LIGNE_ENTETE + lignes.length, column: colonnes.length },
    };
    // L'en-tête reste visible quand la gérante fait défiler mille lignes.
    ws.views = [{ state: 'frozen', ySplit: LIGNE_ENTETE }];

    let ligneTotal = LIGNE_ENTETE + lignes.length + 2;
    for (const t of totaux) {
      const label = ws.getCell(ligneTotal, 1);
      label.value = t.label;
      label.font = { bold: true };
      const valeur = ws.getCell(ligneTotal, 2);
      valeur.value = t.valeur;
      valeur.font = { bold: true };
      if (t.format) valeur.numFmt = t.format;
      ligneTotal += 1;
    }

    return ws;
  }

  private async fichier(wb: Workbook, base: string, query: ExportRangeDto) {
    // Nom sans accent ni espace : il traverse un en-tête HTTP, puis un système
    // de fichiers Windows.
    const periode =
      query.from || query.to
        ? `${query.from ?? 'debut'}_${query.to ?? this.maintenantAuCentre()}`
        : 'tout';
    return {
      // exceljs déclare son propre type `Buffer` (un ArrayBuffer) : on repasse
      // par celui de Node, seul type qu'Express sait envoyer tel quel.
      buffer: Buffer.from(await wb.xlsx.writeBuffer()),
      filename: `${base}_${periode}.xlsx`,
    };
  }
}
