import { useEffect, useState, useMemo } from 'react';
import { productsApi, Product, Category } from '../api/products';
import { servicesApi, Service } from '../api/services';
import { mediaUrl } from '../api/config';
import { useAuthStore } from '../stores/authStore';
import { formatPrice } from '../utils';
import CatalogForm, { CatalogFormValues, CatalogKind } from '../components/CatalogForm';
import Confirm from '../components/Confirm';

const LOW_STOCK = 5;

export default function CatalogPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  const [kind, setKind] = useState<CatalogKind>('product');
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [prodCats, setProdCats] = useState<Category[]>([]);
  const [servCats, setServCats] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string>('ALL');
  const [showInactive, setShowInactive] = useState(false);

  // Formulaire création / édition
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | Service | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Confirmation de désactivation
  const [toDeactivate, setToDeactivate] = useState<Product | Service | null>(null);
  const [acting, setActing] = useState(false);

  // Gestion des catégories. La création est indispensable — le formulaire
  // produit/prestation exige une catégorie, et sur une base neuve il n'en
  // existe aucune. Le renommage l'est devenu : une faute de frappe était
  // définitive, faute de route pour la corriger.
  const [catFormOpen, setCatFormOpen] = useState(false);
  const [catName, setCatName] = useState('');
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);
  const [catRenamingId, setCatRenamingId] = useState<string | null>(null);
  const [catRenameValue, setCatRenameValue] = useState('');
  const [catToDelete, setCatToDelete] = useState<Category | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      setError(null);
      const [p, s, pc, sc] = await Promise.all([
        productsApi.getAllIncludingInactive(),
        servicesApi.getAllIncludingInactive(),
        productsApi.getCategories(),
        servicesApi.getCategories(),
      ]);
      setProducts(p);
      setServices(s);
      setProdCats(pc);
      setServCats(sc);
    } catch {
      setError('Impossible de charger le catalogue.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Réinitialise les filtres au changement d'onglet
  useEffect(() => {
    setCatFilter('ALL');
    setSearch('');
  }, [kind]);

  const categories = kind === 'product' ? prodCats : servCats;
  const items: (Product | Service)[] = kind === 'product' ? products : services;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (!showInactive && !it.active) return false;
      if (catFilter !== 'ALL' && it.categoryId !== catFilter) return false;
      if (q && !it.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, catFilter, showInactive]);

  const inactiveCount = items.filter((i) => !i.active).length;

  // ── Formulaire ──────────────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (item: Product | Service) => {
    setEditing(item);
    setFormError(null);
    setFormOpen(true);
  };

  const initialValues = useMemo((): Partial<CatalogFormValues> | undefined => {
    if (!editing) return undefined;
    return {
      categoryId: editing.categoryId,
      name: editing.name,
      description: editing.description ?? '',
      price: editing.price,
      stockQty: 'stockQty' in editing ? String(editing.stockQty) : '0',
      durationMin: 'durationMin' in editing ? String(editing.durationMin) : '30',
      imageUrl: editing.imageUrl ?? '',
    };
  }, [editing]);

  const submitForm = async (v: CatalogFormValues) => {
    setFormLoading(true);
    setFormError(null);
    try {
      // Le backend attend des nombres, pas des chaînes
      const base = {
        categoryId: v.categoryId,
        name: v.name.trim(),
        description: v.description.trim() || undefined,
        price: parseFloat(v.price),
        // Sans image : `undefined` à la création (le champ est simplement
        // absent), mais `null` à la modification. C'est ce qui distingue
        // « je ne touche pas à la photo » de « retire la photo » : `undefined`
        // disparaît du JSON, et le serveur garderait l'ancienne.
        imageUrl: v.imageUrl.trim() || (editing ? null : undefined),
      };

      if (kind === 'product') {
        const payload = { ...base, stockQty: parseInt(v.stockQty || '0', 10) };
        if (editing) await productsApi.update(editing.id, payload);
        else await productsApi.create(payload);
      } else {
        const payload = { ...base, durationMin: parseInt(v.durationMin || '30', 10) };
        if (editing) await servicesApi.update(editing.id, payload);
        else await servicesApi.create(payload);
      }

      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (e: any) {
      const msg = e.response?.data?.message;
      setFormError(Array.isArray(msg) ? msg.join(', ') : msg || 'Enregistrement impossible.');
    } finally {
      setFormLoading(false);
    }
  };

  // ── Activation / désactivation ──────────────────────────────────────
  const runDeactivate = async () => {
    if (!toDeactivate) return;
    setActing(true);
    try {
      if (kind === 'product') await productsApi.deactivate(toDeactivate.id);
      else await servicesApi.deactivate(toDeactivate.id);
      setToDeactivate(null);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Action impossible.');
      setToDeactivate(null);
    } finally {
      setActing(false);
    }
  };

  // ── Création de catégorie ───────────────────────────────────────────
  const submitCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = catName.trim();
    if (!name) return;
    setCatSaving(true);
    setCatError(null);
    try {
      const created =
        kind === 'product'
          ? await productsApi.createCategory(name)
          : await servicesApi.createCategory(name);
      // Recharge les catégories et sélectionne la nouvelle comme filtre
      await load();
      setCatFilter(created.id);
      setCatName('');
      setCatFormOpen(false);
    } catch (e: any) {
      const msg = e.response?.data?.message;
      setCatError(Array.isArray(msg) ? msg.join(', ') : msg || 'Création impossible.');
    } finally {
      setCatSaving(false);
    }
  };

  // ── Renommage / suppression de catégorie ────────────────────────────
  const messageErreur = (e: any, defaut: string) => {
    const msg = e.response?.data?.message;
    return Array.isArray(msg) ? msg.join(', ') : msg || defaut;
  };

  const submitRename = async (category: Category) => {
    const name = catRenameValue.trim();
    if (!name || name === category.name) {
      setCatRenamingId(null);
      return;
    }
    setCatSaving(true);
    setCatError(null);
    try {
      if (kind === 'product') await productsApi.renameCategory(category.id, name);
      else await servicesApi.renameCategory(category.id, name);
      // Rechargement complet : le nom de la catégorie est affiché sur chaque
      // ligne du tableau, pas seulement dans cette liste.
      await load();
      setCatRenamingId(null);
    } catch (e: any) {
      setCatError(messageErreur(e, 'Renommage impossible.'));
    } finally {
      setCatSaving(false);
    }
  };

  const submitDeleteCategory = async () => {
    if (!catToDelete) return;
    setCatSaving(true);
    setCatError(null);
    try {
      if (kind === 'product') await productsApi.deleteCategory(catToDelete.id);
      else await servicesApi.deleteCategory(catToDelete.id);
      // Le filtre pointait peut-être sur la catégorie qui vient de disparaître.
      if (catFilter === catToDelete.id) setCatFilter('ALL');
      await load();
      setCatToDelete(null);
    } catch (e: any) {
      setCatError(messageErreur(e, 'Suppression impossible.'));
      setCatToDelete(null);
    } finally {
      setCatSaving(false);
    }
  };

  const closeCatForm = () => {
    setCatFormOpen(false);
    setCatRenamingId(null);
    setCatError(null);
    setCatName('');
  };

  const reactivate = async (item: Product | Service) => {
    try {
      if (kind === 'product') await productsApi.update(item.id, { active: true });
      else await servicesApi.update(item.id, { active: true });
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Réactivation impossible.');
    }
  };

  const noun = kind === 'product' ? 'produit' : 'prestation';

  return (
    <div>
      <div className="row between" style={{ marginBottom: 'var(--sp-4)' }}>
        <div>
          <h1>Catalogue</h1>
          <div className="muted small">
            {isAdmin
              ? 'Gérez vos produits et prestations : prix, stock, disponibilité.'
              : 'Consultation du catalogue. La modification est réservée à l’administrateur.'}
          </div>
        </div>
        <div className="row gap-2">
          <button className="btn btn-outline btn-sm" onClick={load}>Actualiser</button>
          {isAdmin && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                setCatError(null);
                setCatName('');
                setCatRenamingId(null);
                setCatFormOpen(true);
              }}
            >
              Catégories
            </button>
          )}
          {isAdmin && (
            <button className="btn btn-gold btn-sm" onClick={openCreate}>
              + Nouveau {noun}
            </button>
          )}
        </div>
      </div>

      {/* Onglets produits / prestations */}
      <div className="row gap-2" style={{ marginBottom: 'var(--sp-4)' }}>
        <button
          className={kind === 'product' ? 'btn btn-gold btn-sm' : 'btn btn-outline btn-sm'}
          onClick={() => setKind('product')}
        >
          Produits <span style={{ marginLeft: 6, opacity: 0.7 }}>{products.length}</span>
        </button>
        <button
          className={kind === 'service' ? 'btn btn-gold btn-sm' : 'btn btn-outline btn-sm'}
          onClick={() => setKind('service')}
        >
          Prestations <span style={{ marginLeft: 6, opacity: 0.7 }}>{services.length}</span>
        </button>
      </div>

      {/* Barre de filtres */}
      <div className="card card-pad row gap-3" style={{ marginBottom: 'var(--sp-4)', flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom…"
          style={{ maxWidth: 260 }}
        />
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          style={{ maxWidth: 200 }}
        >
          <option value="ALL">Toutes les catégories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <label className="row gap-2 small" style={{ cursor: 'pointer', width: 'auto' }}>
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            style={{ width: 'auto' }}
          />
          Afficher les désactivés
          {inactiveCount > 0 && <span className="muted">({inactiveCount})</span>}
        </label>
      </div>

      {error && (
        <div className="card card-pad" style={{ marginBottom: 'var(--sp-4)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {isLoading ? (
        <div style={{ display: 'grid', placeItems: 'center', height: 200 }}>
          <div className="spinner" />
        </div>
      ) : visible.length === 0 ? (
        <div className="card card-pad muted">Aucun élément ne correspond.</div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th style={{ width: 48 }}></th>
                <th>Nom</th>
                <th>Catégorie</th>
                <th style={{ textAlign: 'right' }}>Prix</th>
                <th style={{ textAlign: 'right' }}>
                  {kind === 'product' ? 'Stock' : 'Durée'}
                </th>
                <th>Statut</th>
                {isAdmin && <th style={{ textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {visible.map((it) => {
                const isProduct = 'stockQty' in it;
                return (
                  <tr key={it.id} style={{ opacity: it.active ? 1 : 0.55 }}>
                    <td>
                      <div style={styles.thumb}>
                        {it.imageUrl ? (
                          <img src={mediaUrl(it.imageUrl)} alt="" style={styles.thumbImg} />
                        ) : (
                          <span className="muted" style={{ fontSize: 10 }}>—</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{it.name}</div>
                      {it.description && (
                        <div className="small muted" style={styles.desc}>{it.description}</div>
                      )}
                    </td>
                    <td className="small muted">{it.category?.name ?? '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatPrice(it.price)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {isProduct ? (
                        <span
                          className={`badge ${
                            (it as Product).stockQty === 0
                              ? 'badge-danger'
                              : (it as Product).stockQty <= LOW_STOCK
                              ? 'badge-warning'
                              : 'badge-muted'
                          }`}
                        >
                          {(it as Product).stockQty}
                        </span>
                      ) : (
                        <span className="small">{(it as Service).durationMin} min</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${it.active ? 'badge-success' : 'badge-muted'}`}>
                        {it.active ? 'Actif' : 'Désactivé'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td style={{ textAlign: 'right' }}>
                        <div className="row gap-2" style={{ justifyContent: 'flex-end' }}>
                          <button className="btn btn-outline btn-sm" onClick={() => openEdit(it)}>
                            Modifier
                          </button>
                          {it.active ? (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => setToDeactivate(it)}
                            >
                              Désactiver
                            </button>
                          ) : (
                            <button className="btn btn-gold btn-sm" onClick={() => reactivate(it)}>
                              Réactiver
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CatalogForm
        open={formOpen}
        kind={kind}
        categories={categories}
        initial={initialValues}
        isEdit={!!editing}
        loading={formLoading}
        error={formError}
        onSubmit={submitForm}
        onCancel={() => {
          setFormOpen(false);
          setEditing(null);
        }}
      />

      {/* Modal : gestion des catégories */}
      {catFormOpen && (
        <div style={styles.backdrop} onClick={closeCatForm}>
          <div
            className="card"
            style={styles.catCard}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.accent} />
            <h2 style={{ marginBottom: 'var(--sp-2)' }}>
              Catégories {kind === 'product' ? 'de produits' : 'de prestations'}
            </h2>
            <div className="muted small" style={{ marginBottom: 'var(--sp-4)' }}>
              Renommez une catégorie mal orthographiée, ou retirez-en une qui ne
              sert plus. Une catégorie qui contient encore des éléments ne peut
              pas être supprimée.
            </div>

            {categories.length > 0 && (
              <div style={{ marginBottom: 'var(--sp-4)' }}>
                {categories.map((c) => (
                  <div
                    key={c.id}
                    className="row gap-2"
                    style={{ marginBottom: 6, flexWrap: 'wrap' }}
                  >
                    {catRenamingId === c.id ? (
                      <>
                        <input
                          autoFocus
                          value={catRenameValue}
                          onChange={(e) => setCatRenameValue(e.target.value)}
                          style={{ flex: 1, minWidth: 160 }}
                        />
                        <button
                          className="btn btn-gold btn-sm"
                          disabled={catSaving || !catRenameValue.trim()}
                          onClick={() => submitRename(c)}
                        >
                          {catSaving ? '…' : 'Enregistrer'}
                        </button>
                        <button
                          className="btn btn-outline btn-sm"
                          disabled={catSaving}
                          onClick={() => setCatRenamingId(null)}
                        >
                          Annuler
                        </button>
                      </>
                    ) : (
                      <>
                        <span style={{ flex: 1, minWidth: 160 }}>{c.name}</span>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => {
                            setCatError(null);
                            setCatRenamingId(c.id);
                            setCatRenameValue(c.name);
                          }}
                        >
                          Renommer
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => setCatToDelete(c)}
                        >
                          Supprimer
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={submitCategory}>
              <label className="label" style={{ display: 'block', marginBottom: 5 }}>
                Nouvelle catégorie
              </label>
              <div className="row gap-2">
                <input
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder={kind === 'product' ? 'Soins capillaires' : 'Soins du visage'}
                  style={{ flex: 1 }}
                />
                <button
                  type="submit"
                  className="btn btn-gold"
                  disabled={catSaving || !catName.trim()}
                >
                  {catSaving ? '…' : 'Créer'}
                </button>
              </div>
            </form>

            {catError && (
              <div
                style={{
                  marginTop: 'var(--sp-3)',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--danger-bg)',
                  color: 'var(--danger)',
                  fontSize: 13,
                }}
              >
                {catError}
              </div>
            )}

            <div className="row gap-2" style={{ justifyContent: 'flex-end', marginTop: 'var(--sp-5)' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={closeCatForm}
                disabled={catSaving}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      <Confirm
        open={!!catToDelete}
        title={`Supprimer « ${catToDelete?.name ?? ''} »`}
        message="La catégorie disparaîtra définitivement. Le serveur refuse la suppression si elle contient encore des éléments."
        confirmLabel="Supprimer"
        danger
        loading={catSaving}
        onConfirm={submitDeleteCategory}
        onCancel={() => setCatToDelete(null)}
      />

      <Confirm
        open={!!toDeactivate}
        title={`Désactiver « ${toDeactivate?.name ?? ''} »`}
        message={`Cet élément ne sera plus visible par les clientes. Vous pourrez le réactiver à tout moment.`}
        confirmLabel="Désactiver"
        danger
        loading={acting}
        onConfirm={runDeactivate}
        onCancel={() => setToDeactivate(null)}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(20,16,12,0.55)',
    display: 'grid',
    placeItems: 'center',
    zIndex: 100,
    padding: 'var(--sp-4)',
    overflowY: 'auto',
  },
  catCard: {
    width: '100%',
    maxWidth: 420,
    padding: 'var(--sp-5)',
    position: 'relative',
    overflow: 'hidden',
    margin: 'auto',
  },
  accent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    background: 'linear-gradient(90deg, var(--gold-light), var(--gold))',
  },
  thumb: {
    width: 36,
    height: 36,
    borderRadius: 'var(--radius-sm)',
    background: 'var(--surface-alt)',
    display: 'grid',
    placeItems: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%', objectFit: 'cover' },
  desc: {
    maxWidth: 320,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
};
