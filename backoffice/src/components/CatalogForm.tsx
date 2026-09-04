import { useState, useEffect, useRef, ChangeEvent, FormEvent } from 'react';
import { Category } from '../api/products';
import { mediaUrl } from '../api/config';
import { uploadsApi, MAX_IMAGE_BYTES } from '../api/uploads';

export type CatalogKind = 'product' | 'service';

// Les trois langues de l'application, et les champs que chacune remplit.
//
// Le français n'est pas une traduction : c'est la fiche, celle qui s'affiche
// tant que les deux autres sont vides. D'où l'ordre, et d'où la pastille qui
// ne peut apparaître que sur l'arabe et l'anglais.
const LANGUES = [
  { code: 'fr', libelle: 'Français', nom: 'name', desc: 'description', rtl: false },
  { code: 'ar', libelle: 'العربية', nom: 'nameAr', desc: 'descriptionAr', rtl: true },
  { code: 'en', libelle: 'English', nom: 'nameEn', desc: 'descriptionEn', rtl: false },
] as const;

type CodeLangue = (typeof LANGUES)[number]['code'];

// Valeurs du formulaire — communes aux produits et aux prestations.
// `stockQty` ne concerne que les produits, `durationMin` que les prestations —
// cette dernière est facultative et n'entre pas dans le calcul des créneaux.
// `imageUrl` n'est PAS une adresse saisie à la main : c'est le chemin renvoyé
// par le serveur après téléversement (« /uploads/….webp »).
export interface CatalogFormValues {
  categoryId: string;
  name: string;
  nameAr: string;
  nameEn: string;
  description: string;
  descriptionAr: string;
  descriptionEn: string;
  price: string;
  stockQty: string;
  durationMin: string;
  imageUrl: string;
}

const EMPTY: CatalogFormValues = {
  categoryId: '',
  name: '',
  nameAr: '',
  nameEn: '',
  description: '',
  descriptionAr: '',
  descriptionEn: '',
  price: '',
  stockQty: '0',
  durationMin: '',
  imageUrl: '',
};

interface CatalogFormProps {
  open: boolean;
  kind: CatalogKind;
  categories: Category[];
  initial?: Partial<CatalogFormValues>;
  isEdit: boolean;
  loading?: boolean;
  error?: string | null;
  onSubmit: (values: CatalogFormValues) => void;
  onCancel: () => void;
}

export default function CatalogForm({
  open,
  kind,
  categories,
  initial,
  isEdit,
  loading = false,
  error,
  onSubmit,
  onCancel,
}: CatalogFormProps) {
  const [values, setValues] = useState<CatalogFormValues>(EMPTY);
  const [langue, setLangue] = useState<CodeLangue>('fr');
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Réinitialise le formulaire à chaque ouverture
  useEffect(() => {
    if (open) {
      setValues({ ...EMPTY, ...initial });
      // Toujours rouvrir sur le français : c'est la langue de saisie, et
      // rouvrir sur l'onglet arabe d'une fiche précédente ferait croire que
      // le champ vide de celle-ci a été effacé.
      setLangue('fr');
      setUploading(false);
      setImageError(null);
    }
  }, [open, initial]);

  if (!open) return null;

  const set = (k: keyof CatalogFormValues, v: string) =>
    setValues((prev) => ({ ...prev, [k]: v }));

  // Le fichier part vers l'API dès qu'il est choisi, et non à l'enregistrement :
  // le formulaire n'a ainsi qu'un chemin de texte à soumettre, exactement comme
  // avant. C'est aussi ce qui permet d'afficher l'aperçu tout de suite — et de
  // voir un refus (format, poids) avant d'avoir rempli le reste.
  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Le champ est remis à zéro tout de suite : sans ça, rechoisir LE MÊME
    // fichier après un échec ne déclenchait aucun `change`, et le bouton
    // paraissait mort.
    e.target.value = '';
    if (!file) return;

    if (file.size > MAX_IMAGE_BYTES) {
      setImageError(`Image trop lourde (${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} Mo maximum).`);
      return;
    }

    setUploading(true);
    setImageError(null);
    try {
      set('imageUrl', await uploadsApi.uploadImage(file));
    } catch (err: any) {
      const msg = err.response?.data?.message;
      setImageError(Array.isArray(msg) ? msg.join(', ') : msg || "Envoi de l'image impossible.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };

  const noun = kind === 'product' ? 'produit' : 'prestation';
  const actif = LANGUES.find((l) => l.code === langue)!;
  const enFrancais = langue === 'fr';

  return (
    <div style={styles.backdrop} onClick={onCancel}>
      <form
        className="card"
        style={styles.card}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div style={styles.accent} />

        <h2 style={{ marginBottom: 'var(--sp-4)' }}>
          {isEdit ? `Modifier le ${noun}` : `Nouveau ${noun}`}
        </h2>

        <div style={styles.fields}>
          <Field label="Catégorie">
            {categories.length === 0 ? (
              <div
                className="small"
                style={{
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--warning-bg)',
                  color: 'var(--warning)',
                }}
              >
                Aucune catégorie. Fermez cette fenêtre et créez d'abord une
                catégorie avec le bouton « + Catégorie ».
              </div>
            ) : (
              <select
                value={values.categoryId}
                onChange={(e) => set('categoryId', e.target.value)}
                required
              >
                <option value="">— Choisir —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <div style={styles.langues}>
            {LANGUES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setLangue(l.code)}
                style={{
                  ...styles.langue,
                  ...(l.code === langue ? styles.langueActive : null),
                }}
              >
                {l.libelle}
                {/* Un point discret, et non un mot : la pastille se lit d'un
                    coup d'œil sur les deux onglets à la fois. */}
                {l.code !== 'fr' && !values[l.nom].trim() && (
                  <span style={styles.pastille} title="Pas encore traduit" />
                )}
              </button>
            ))}
          </div>

          <Field label="Nom">
            <input
              key={`nom-${langue}`}
              value={values[actif.nom]}
              onChange={(e) => set(actif.nom, e.target.value)}
              dir={actif.rtl ? 'rtl' : undefined}
              placeholder={
                enFrancais
                  ? kind === 'product'
                    ? 'Huile précieuse à l’argan'
                    : 'Soin visage signature'
                  : 'Optionnel'
              }
              required={enFrancais}
            />
          </Field>

          <Field label="Description">
            <textarea
              key={`desc-${langue}`}
              value={values[actif.desc]}
              onChange={(e) => set(actif.desc, e.target.value)}
              dir={actif.rtl ? 'rtl' : undefined}
              rows={3}
              placeholder="Optionnel"
              style={{ resize: 'vertical' }}
            />
          </Field>

          {!enFrancais && (
            <div className="small muted" style={{ marginTop: -6 }}>
              Laissez vide pour afficher le français aux clientes : une fiche
              non traduite reste lisible, elle ne devient pas blanche.
            </div>
          )}

          <div style={styles.twoCols}>
            <Field label="Prix (dh)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={values.price}
                onChange={(e) => set('price', e.target.value)}
                placeholder="0.00"
                required
              />
            </Field>

            {kind === 'product' ? (
              <Field label="Stock">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={values.stockQty}
                  onChange={(e) => set('stockQty', e.target.value)}
                />
              </Field>
            ) : (
              <Field label="Durée (min)">
                <input
                  type="number"
                  min="1"
                  step="5"
                  value={values.durationMin}
                  onChange={(e) => set('durationMin', e.target.value)}
                  placeholder="Optionnel"
                />
              </Field>
            )}
          </div>

          {/* Le champ est purement informatif depuis que les rendez-vous sont
              espacés d'un écart fixe. Le dire ici, sous le champ : sans cette
              ligne, on croit légitimement que le remplir change les créneaux. */}
          {kind === 'service' && (
            <div className="small muted" style={{ marginTop: -6 }}>
              La durée ne sert qu'à votre organisation : les créneaux proposés
              aux clientes suivent l'écart réglé dans les paramètres, quelle que
              soit la prestation.
            </div>
          )}

          <Field label="Image">
            <div style={styles.image}>
              <div style={styles.preview}>
                {values.imageUrl ? (
                  <img src={mediaUrl(values.imageUrl)} alt="" style={styles.previewImg} />
                ) : (
                  <span className="muted" style={{ fontSize: 11 }}>Aucune</span>
                )}
              </div>

              <div style={styles.imageActions}>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFile}
                  style={{ display: 'none' }}
                />
                <div className="row gap-2">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => fileInput.current?.click()}
                    disabled={uploading || loading}
                  >
                    {uploading
                      ? 'Envoi…'
                      : values.imageUrl
                        ? 'Remplacer'
                        : 'Choisir une image'}
                  </button>
                  {values.imageUrl && !uploading && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => {
                        set('imageUrl', '');
                        setImageError(null);
                      }}
                      disabled={loading}
                    >
                      Retirer
                    </button>
                  )}
                </div>
                <div className="small muted">JPEG, PNG ou WebP — 5 Mo maximum.</div>
              </div>
            </div>

            {imageError && <div style={styles.error}>{imageError}</div>}
          </Field>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <div className="row gap-2" style={{ justifyContent: 'flex-end', marginTop: 'var(--sp-5)' }}>
          <button type="button" className="btn btn-outline" onClick={onCancel} disabled={loading}>
            Annuler
          </button>
          {/* Bloqué pendant l'envoi de l'image : enregistrer maintenant
              sauvegarderait la fiche avec l'ANCIENNE photo, ou sans photo. */}
          <button type="submit" className="btn btn-gold" disabled={loading || uploading}>
            {loading ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label" style={{ display: 'block', marginBottom: 5 }}>
        {label}
      </label>
      {children}
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
  card: {
    width: '100%',
    maxWidth: 460,
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
  fields: { display: 'grid', gap: 'var(--sp-3)' },
  langues: {
    display: 'flex',
    gap: 4,
    padding: 3,
    borderRadius: 'var(--radius-sm)',
    background: 'var(--surface-alt)',
    border: '1px solid var(--border)',
  },
  langue: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '6px 8px',
    border: 'none',
    borderRadius: 'calc(var(--radius-sm) - 2px)',
    background: 'transparent',
    color: 'var(--text-muted)',
    font: 'inherit',
    fontSize: 13,
    cursor: 'pointer',
  },
  langueActive: {
    background: 'var(--surface)',
    color: 'var(--text)',
    boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
  },
  pastille: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--warning)',
    flexShrink: 0,
  },
  twoCols: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' },
  image: { display: 'flex', gap: 'var(--sp-3)', alignItems: 'center' },
  preview: {
    width: 72,
    height: 72,
    flexShrink: 0,
    borderRadius: 'var(--radius-sm)',
    background: 'var(--surface-alt)',
    border: '1px solid var(--border)',
    display: 'grid',
    placeItems: 'center',
    overflow: 'hidden',
  },
  previewImg: { width: '100%', height: '100%', objectFit: 'cover' },
  imageActions: { display: 'grid', gap: 6 },
  error: {
    marginTop: 'var(--sp-3)',
    padding: '8px 10px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--danger-bg)',
    color: 'var(--danger)',
    fontSize: 13,
  },
};