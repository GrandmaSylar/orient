import React, { useState, useEffect } from 'react';
import { Plus, Edit2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface Product {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
}

interface ProductSetupProps {
  showDialog: (
    type: 'success' | 'warning' | 'error' | 'confirm',
    title: string,
    message: string,
    onConfirm?: () => void,
    onCancel?: () => void
  ) => void;
}

export const ProductSetup: React.FC<ProductSetupProps> = ({ showDialog }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals/Forms State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await window.electronAPI.invoke('db-query', {
        query: 'SELECT id, name, description, is_active FROM products ORDER BY name ASC'
      });
      if (res.success && res.recordset) {
        setProducts(res.recordset);
      } else {
        setError(res.error || 'Failed to query products.');
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred fetching products.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setName('');
    setDescription('');
    setError(null);
    setShowAddModal(true);
  };

  const handleOpenEdit = (product: Product) => {
    setSelectedProduct(product);
    setName(product.name);
    setDescription(product.description || '');
    setError(null);
    setShowEditModal(true);
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await window.electronAPI.invoke('db-query', {
        query: 'INSERT INTO products (name, description, is_active) VALUES (@name, @description, 1)',
        params: [
          { name: 'name', value: name },
          { name: 'description', value: description }
        ]
      });

      if (res.success) {
        setShowAddModal(false);
        fetchProducts();
        showDialog('success', 'Product Created', `"${name}" has been added to available fee structures.`);
      } else {
        setError(res.error || 'Failed to create product. Ensure the name is unique.');
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred saving product.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await window.electronAPI.invoke('db-query', {
        query: 'UPDATE products SET name = @name, description = @description WHERE id = @id',
        params: [
          { name: 'id', value: selectedProduct.id },
          { name: 'name', value: name },
          { name: 'description', value: description }
        ]
      });

      if (res.success) {
        setShowEditModal(false);
        fetchProducts();
        showDialog('success', 'Changes Saved', `Product details updated successfully.`);
      } else {
        setError(res.error || 'Failed to update product.');
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred updating product.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleProductStatus = async (product: Product) => {
    const nextStatus = !product.is_active;
    const confirmMsg = nextStatus
      ? `Are you sure you want to activate the product "${product.name}"?`
      : `Are you sure you want to deactivate the product "${product.name}"? Inactive products cannot be selected during payment.`;

    showDialog('confirm', 'Confirm Action', confirmMsg, async () => {
      try {
        const res = await window.electronAPI.invoke('db-query', {
          query: 'UPDATE products SET is_active = @is_active WHERE id = @id',
          params: [
            { name: 'id', value: product.id },
            { name: 'is_active', value: nextStatus }
          ]
        });

        if (res.success) {
          fetchProducts();
          showDialog('success', 'Status Updated', `Product status for "${product.name}" updated successfully.`);
        } else {
          showDialog('error', 'Database Error', res.error || 'Failed to update product status.');
        }
      } catch (err: any) {
        showDialog('error', 'System Error', err.message || 'Error occurred toggling product status.');
      }
    });
  };

  return (
    <div className="animate-fade-in" style={{ width: '100%' }}>
      {/* Controls Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <p style={{ color: 'var(--text-secondary)' }}>
          Manage products available for deposits (e.g. School Fees, stationery, Summer Classes).
        </p>
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          <Plus size={18} /> New Product
        </button>
      </div>

      {/* Main Table Panel */}
      <div className="panel" style={{ padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="skeleton skeleton-row" />
            <div className="skeleton skeleton-row" />
            <div className="skeleton skeleton-row" />
          </div>
        ) : products.length === 0 ? (
          <div style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <AlertCircle size={40} style={{ color: 'var(--text-tertiary)', marginBottom: '12px' }} />
            <h3>No Products Defined</h3>
            <p>Setup your first payment structure by clicking "New Product" above.</p>
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Product Name</th>
                  <th style={{ width: '50%' }}>Description</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} style={{ opacity: product.is_active ? 1 : 0.6 }}>
                    <td>
                      <strong>{product.name}</strong>
                    </td>
                    <td>{product.description || <em style={{ color: 'var(--text-tertiary)' }}>No description</em>}</td>
                    <td>
                      <span style={{
                        display: 'inline-flex',
                        padding: '2px 8px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        borderRadius: '4px',
                        backgroundColor: product.is_active ? 'var(--accent-success-light)' : 'var(--accent-danger-light)',
                        color: product.is_active ? 'var(--accent-success-hover)' : 'var(--accent-danger)'
                      }}>
                        {product.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button 
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenEdit(product)}
                          style={{ padding: '6px 8px' }}
                          title="Edit Product"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          className={`btn ${product.is_active ? 'btn-danger' : 'btn-success'} btn-sm`}
                          onClick={() => toggleProductStatus(product)}
                          style={{ padding: '6px 8px' }}
                          title={product.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {product.is_active ? <XCircle size={14} /> : <CheckCircle size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADD MODAL */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale-in">
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.25rem' }}>Create Payment Product</h3>
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)} style={{ padding: '4px 8px' }}>✕</button>
            </div>
            
            <form onSubmit={handleAddProduct} style={{ padding: '24px' }}>
              <div className="form-group">
                <label className="form-label">Product Name</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  required 
                  placeholder="e.g. School Fees"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description / Details</label>
                <textarea 
                  className="form-control" 
                  rows={3}
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)} 
                  placeholder="Describe when this deposit fee product is used..."
                  style={{ resize: 'vertical' }}
                />
              </div>

              {error && (
                <div style={{ padding: '10px', color: 'var(--accent-danger)', backgroundColor: 'var(--accent-danger-light)', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '0.9rem' }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && selectedProduct && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale-in">
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.25rem' }}>Edit Product Details</h3>
              <button className="btn btn-secondary" onClick={() => setShowEditModal(false)} style={{ padding: '4px 8px' }}>✕</button>
            </div>
            
            <form onSubmit={handleEditProduct} style={{ padding: '24px' }}>
              <div className="form-group">
                <label className="form-label">Product Name</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description / Details</label>
                <textarea 
                  className="form-control" 
                  rows={3}
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)} 
                  style={{ resize: 'vertical' }}
                />
              </div>

              {error && (
                <div style={{ padding: '10px', color: 'var(--accent-danger)', backgroundColor: 'var(--accent-danger-light)', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '0.9rem' }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
