import { useState, useEffect, FormEvent } from 'react';
import { Category } from '../api/products';

export type CatalogKind = 'product' | 'service';

// Valeurs du formulaire — communes aux produits et aux prestations.
// `stockQty` ne concerne que les produits, `durationMin` que les prestations.
export interface CatalogFormValues {
  categoryId: string;
  name: string;
  description: string;
  price: string;
  stockQty: string;
  durationMin: string;
  imageUrl: string;
}

const EMPTY: CatalogFormValues = {
  categoryId: '',
  name: '',
  description: '',
  price: '',
  stockQty: '0',
  durationMin: '30',
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

  // Réinitialise le formulaire à chaque ouverture
  useEffect(() => {
    if (open) setValues({ ...EMPTY, ...initial });
  }, [open, initial]);

  if (!open) return null;

  const set = (k: keyof CatalogFormValues, v: string) =>
    setValues((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };

  const noun = kind === 'product' ? 'produit' : 'prestation';

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
          </Field>

          <Field label="Nom">
            <input
              value={values.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder={kind === 'product' ? 'Huile précieuse à l’argan' : 'Soin visage signature'}
              required
            />
          </Field>

          <Field label="Description">
            <textarea
              value={values.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              placeholder="Optionnel"
              style={{ resize: 'vertical' }}
            />
          </Field>

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
                  required
                />
              </Field>
            )}
          </div>

          <Field label="Image (URL)">
            <input
              value={values.imageUrl}
              onChange={(e) => set('imageUrl', e.target.value)}
              placeholder="https://…"
            />
          </Field>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <div className="row gap-2" style={{ justifyContent: 'flex-end', marginTop: 'var(--sp-5)' }}>
          <button type="button" className="btn btn-outline" onClick={onCancel} disabled={loading}>
            Annuler
          </button>
          <button type="submit" className="btn btn-gold" disabled={loading}>
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
  twoCols: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' },
  error: {
    marginTop: 'var(--sp-3)',
    padding: '8px 10px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--danger-bg)',
    color: 'var(--danger)',
    fontSize: 13,
  },
};