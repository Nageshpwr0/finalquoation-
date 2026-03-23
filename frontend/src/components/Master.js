import React, { useState, useEffect } from 'react';
import '../design-system.css';
import MobileTableWrapper from './MobileTableWrapper';

const Modal = ({ show, onClose, children }) => {
    if (!show) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white m-auto p-6 rounded-lg shadow-lg text-center relative w-11/12 max-w-md">
                <button onClick={onClose} className="absolute top-2 right-4 text-gray-500 hover:text-gray-800 text-3xl font-bold">&times;</button>
                {children}
            </div>
        </div>
    );
};

const CustomerMaster = ({ apiUrl, onCustomersUpdate }) => {
    const [customers, setCustomers] = useState([]);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [formData, setFormData] = useState({
        name: '', company: '', gst: '', address: '', email: '', phone: ''
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        loadCustomers();
        
        // Listen for storage changes
        const handleStorageChange = () => {
            loadCustomers();
        };
        window.addEventListener('storage', handleStorageChange);
        
        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

    const loadCustomers = () => {
        if (apiUrl) {
            fetch(`${apiUrl}/api/customers-detailed`)
                .then(res => {
                    if (!res.ok) {
                        throw new Error(`HTTP error! status: ${res.status}`);
                    }
                    return res.json();
                })
                .then(data => {
                    if (data && data.data) {
                        setCustomers(data.data);
                    }
                })
                .catch(error => {
                    console.error('Error loading customers:', error);
                    setError('Failed to load customers');
                });
        } else {
            const saved = localStorage.getItem('customers');
            setCustomers(saved ? JSON.parse(saved) : []);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        
        if (!apiUrl) {
            // Save to local state when no API
            const newCustomer = { ...formData, id: Date.now() };
            let updatedCustomers;
            if (editingCustomer) {
                updatedCustomers = customers.map(c => c.id === editingCustomer.id ? newCustomer : c);
                setSuccess('Customer updated successfully!');
            } else {
                updatedCustomers = [...customers, newCustomer];
                setSuccess('Customer created successfully!');
            }
            setCustomers(updatedCustomers);
            localStorage.setItem('customers', JSON.stringify(updatedCustomers));
            setFormData({ name: '', company: '', gst: '', address: '', email: '', phone: '' });
            setEditingCustomer(null);
            if (onCustomersUpdate) onCustomersUpdate();
            window.dispatchEvent(new Event('storage'));
            setTimeout(() => setSuccess(''), 3000);
            return;
        }
        
        const url = editingCustomer 
            ? `${apiUrl}/api/customers-detailed/${editingCustomer.id}`
            : `${apiUrl}/api/customers-detailed`;
        const method = editingCustomer ? 'PUT' : 'POST';
        
        fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        })
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => {
                    try {
                        const err = JSON.parse(text);
                        throw new Error(err.error || 'Network response was not ok');
                    } catch {
                        throw new Error('Server returned an error');
                    }
                });
            }
            return response.json();
        })
        .then(data => {
            setSuccess(editingCustomer ? 'Customer updated successfully!' : 'Customer created successfully!');
            loadCustomers();
            setFormData({ name: '', company: '', gst: '', address: '', email: '', phone: '' });
            setEditingCustomer(null);
            if (onCustomersUpdate) onCustomersUpdate();
            setTimeout(() => setSuccess(''), 3000);
        })
        .catch(error => {
            console.error('Error saving customer:', error);
            setError(error.message || 'Failed to save customer. Please try again.');
        });
    };

    const handleEdit = (customer) => {
        setFormData(customer);
        setEditingCustomer(customer);
    };

    const handleCancel = () => {
        setFormData({ name: '', company: '', gst: '', address: '', email: '', phone: '' });
        setEditingCustomer(null);
    };

    return (
        <div style={{display: 'flex', gap: '40px'}}>
            <div style={{flex: '1', maxWidth: '400px'}}>
                <h3 className="text-lg font-semibold mb-3">Add Customer</h3>
                <form onSubmit={handleSubmit} className="cut-to-sheet-form">
                    <div style={{display: 'grid', gridTemplateColumns: '1fr', gap: '16px'}}>
                        <div className="form-group">
                            <label className="input-label">Customer Name</label>
                            <input 
                                type="text" 
                                className="input-box" 
                                value={formData.name} 
                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                                required 
                            />
                        </div>
                        <div className="form-group">
                            <label className="input-label">Company Name</label>
                            <input 
                                type="text" 
                                className="input-box" 
                                value={formData.company} 
                                onChange={(e) => setFormData({...formData, company: e.target.value})}
                            />
                        </div>
                        <div className="form-group">
                            <label className="input-label">GST No</label>
                            <input 
                                type="text" 
                                className="input-box" 
                                value={formData.gst} 
                                onChange={(e) => setFormData({...formData, gst: e.target.value})}
                            />
                        </div>
                        <div className="form-group">
                            <label className="input-label">Email Address</label>
                            <input 
                                type="email" 
                                className="input-box" 
                                value={formData.email} 
                                onChange={(e) => setFormData({...formData, email: e.target.value})}
                            />
                        </div>
                        <div className="form-group">
                            <label className="input-label">Phone Number</label>
                            <input 
                                type="tel" 
                                className="input-box" 
                                value={formData.phone} 
                                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                            />
                        </div>
                        <div className="form-group">
                            <label className="input-label">Address</label>
                            <textarea 
                                className="input-box" 
                                rows="3"
                                value={formData.address} 
                                onChange={(e) => setFormData({...formData, address: e.target.value})}
                            />
                        </div>
                    </div>
                    <div className="center-align-container">
                        <button type="submit" className="save-btn-modern">
                            {editingCustomer ? 'Update Customer' : 'Create Customer'}
                        </button>
                        {editingCustomer && (
                            <button type="button" className="delete-btn-modern" onClick={handleCancel}>
                                Cancel
                            </button>
                        )}
                    </div>
                </form>
                {error && <p className="text-red-600 mt-2">{error}</p>}
                {success && <p className="text-green-600 mt-2">{success}</p>}
            </div>
            
            <div style={{flex: '2'}}>
                <h3 className="text-lg font-semibold mb-3">Customer List</h3>
                <MobileTableWrapper>
                    <table className="result-table-modern">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Company</th>
                                <th>GST</th>
                                <th>Email</th>
                                <th>Phone</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {customers.map((customer, index) => (
                                <tr key={index}>
                                    <td>{customer.name}</td>
                                    <td>{customer.company}</td>
                                    <td>{customer.gst}</td>
                                    <td>{customer.email}</td>
                                    <td>{customer.phone}</td>
                                    <td>
                                        <button 
                                            className="save-btn-modern" 
                                            onClick={() => handleEdit(customer)}
                                        >
                                            Edit
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </MobileTableWrapper>
            </div>
        </div>
    );
};

const PaperTypeMaster = ({ apiUrl }) => {
    const [paperTypes, setPaperTypes] = useState([]);
    const [editingPaper, setEditingPaper] = useState(null);
    const [formData, setFormData] = useState({
        name: '', minGsm: '', maxGsm: '', ratePerKg: ''
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        loadPaperTypes();
    }, []);

    const loadPaperTypes = () => {
        if (apiUrl) {
            fetch(`${apiUrl}/api/paper-types`)
                .then(res => {
                    if (!res.ok) {
                        throw new Error(`HTTP error! status: ${res.status}`);
                    }
                    return res.json();
                })
                .then(data => {
                    if (data && data.data) {
                        setPaperTypes(data.data);
                    }
                })
                .catch(error => {
                    console.error('Error loading paper types:', error);
                    setError('Failed to load paper types');
                });
        } else {
            setPaperTypes([]);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        
        if (!apiUrl) {
            setError('API URL not configured. Cannot save paper type.');
            return;
        }
        
        const url = editingPaper 
            ? `${apiUrl}/api/paper-types/${editingPaper.id}`
            : `${apiUrl}/api/paper-types`;
        const method = editingPaper ? 'PUT' : 'POST';
        
        fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        })
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => {
                    try {
                        const err = JSON.parse(text);
                        throw new Error(err.error || 'Network response was not ok');
                    } catch {
                        throw new Error('Server returned an error');
                    }
                });
            }
            return response.json();
        })
        .then(data => {
            setSuccess(editingPaper ? 'Paper type updated successfully!' : 'Paper type created successfully!');
            loadPaperTypes();
            setFormData({ name: '', minGsm: '', maxGsm: '', ratePerKg: '' });
            setEditingPaper(null);
            setTimeout(() => setSuccess(''), 3000);
        })
        .catch(error => {
            console.error('Error saving paper type:', error);
            setError('Failed to save paper type. Please try again.');
        });
    };

    const handleEdit = (paper) => {
        setFormData(paper);
        setEditingPaper(paper);
    };

    const handleCancel = () => {
        setFormData({ name: '', minGsm: '', maxGsm: '', ratePerKg: '' });
        setEditingPaper(null);
    };

    return (
        <div style={{display: 'flex', gap: '40px'}}>
            <div style={{flex: '1', maxWidth: '400px'}}>
                <h3 className="text-lg font-semibold mb-3">Add Paper Type</h3>
                <form onSubmit={handleSubmit} className="cut-to-sheet-form">
                    <div style={{display: 'grid', gridTemplateColumns: '1fr', gap: '16px'}}>
                        <div className="form-group">
                            <label className="input-label">Paper Name</label>
                            <input 
                                type="text" 
                                className="input-box" 
                                value={formData.name} 
                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                                required 
                            />
                        </div>
                        <div className="form-group">
                            <label className="input-label">Min GSM Cap</label>
                            <input 
                                type="number" 
                                className="input-box" 
                                value={formData.minGsm} 
                                onChange={(e) => setFormData({...formData, minGsm: e.target.value})}
                            />
                        </div>
                        <div className="form-group">
                            <label className="input-label">Max GSM Cap</label>
                            <input 
                                type="number" 
                                className="input-box" 
                                value={formData.maxGsm} 
                                onChange={(e) => setFormData({...formData, maxGsm: e.target.value})}
                            />
                        </div>
                        <div className="form-group">
                            <label className="input-label">Rate Per Kg</label>
                            <input 
                                type="number" 
                                step="0.01"
                                className="input-box" 
                                value={formData.ratePerKg} 
                                onChange={(e) => setFormData({...formData, ratePerKg: e.target.value})}
                            />
                        </div>
                    </div>
                    <div className="center-align-container">
                        <button type="submit" className="save-btn-modern">
                            {editingPaper ? 'Update Paper Type' : 'Create Paper Type'}
                        </button>
                        {editingPaper && (
                            <button type="button" className="delete-btn-modern" onClick={handleCancel}>
                                Cancel
                            </button>
                        )}
                    </div>
                </form>
                {error && <p className="text-red-600 mt-2">{error}</p>}
                {success && <p className="text-green-600 mt-2">{success}</p>}
            </div>
            
            <div style={{flex: '2'}}>
                <h3 className="text-lg font-semibold mb-3">Paper Type List</h3>
                <MobileTableWrapper>
                    <table className="result-table-modern">
                        <thead>
                            <tr>
                                <th>Paper Name</th>
                                <th>Min GSM</th>
                                <th>Max GSM</th>
                                <th>Rate Per Kg</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paperTypes.map((paper, index) => (
                                <tr key={index}>
                                    <td>{paper.name}</td>
                                    <td>{paper.minGsm}</td>
                                    <td>{paper.maxGsm}</td>
                                    <td>₹{paper.ratePerKg}</td>
                                    <td>
                                        <button 
                                            className="save-btn-modern" 
                                            onClick={() => handleEdit(paper)}
                                        >
                                            Edit
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </MobileTableWrapper>
            </div>
        </div>
    );
};

const Master = ({ apiUrl, onCustomersUpdate }) => {
    const [activeSection, setActiveSection] = useState('customer');

    return (
        <div className="dashboard-view">
            <h1 className="form-title-pink">Master Data Management</h1>
            
            <div className="center-align-container" style={{marginBottom: '20px'}}>
                <div style={{display: 'flex', gap: '10px'}}>
                    <button 
                        className={`save-btn-modern ${activeSection === 'customer' ? 'active' : ''}`}
                        onClick={() => setActiveSection('customer')}
                    >
                        Customer Master
                    </button>
                    <button 
                        className={`save-btn-modern ${activeSection === 'paper' ? 'active' : ''}`}
                        onClick={() => setActiveSection('paper')}
                    >
                        Paper Type
                    </button>
                </div>
            </div>

            {activeSection === 'customer' && (
                <CustomerMaster apiUrl={apiUrl} onCustomersUpdate={onCustomersUpdate} />
            )}
            
            {activeSection === 'paper' && (
                <PaperTypeMaster apiUrl={apiUrl} />
            )}
        </div>
    );
};

export default Master;
