import React, { useState, useEffect } from 'react';
import '../design-system.css';

// Add missing CSS classes
const additionalStyles = `
.cuttosheet-flex-container {
    display: flex;
    gap: 20px;
    margin-bottom: 20px;
}
.cuttosheet-form-box {
    flex: 1;
}
.cuttosheet-result-box {
    flex: 1;
}
.form-group {
    margin-bottom: 15px;
}
`;

// Inject styles if not already present
if (!document.querySelector('#customer-master-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'customer-master-styles';
    styleSheet.textContent = additionalStyles;
    document.head.appendChild(styleSheet);
}

const CustomerMaster = ({ customers, onAddCustomer, onUpdateCustomer, onDeleteCustomer }) => {
    const [customerName, setCustomerName] = useState('');
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [editName, setEditName] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        onAddCustomer({ customerName });
        setCustomerName('');
    };

    const handleEdit = (customer) => {
        setEditingCustomer(customer.id);
        setEditName(customer.customerName || customer.name);
    };

    const handleUpdate = (customerId) => {
        onUpdateCustomer(customerId, { customerName: editName });
        setEditingCustomer(null);
        setEditName('');
    };

    const handleCancelEdit = () => {
        setEditingCustomer(null);
        setEditName('');
    };

    const handleDelete = (customerId) => {
        if (window.confirm('Are you sure you want to delete this customer?')) {
            onDeleteCustomer(customerId);
        }
    };

    return (
        <div style={{ padding: '20px' }}>
            {/* Customer Master Form */}
            <div className="cuttosheet-box" style={{ marginBottom: '30px' }}>
                <h1 className="form-title-pink">Customer Master</h1>
                <form onSubmit={handleSubmit}>
                    <div className="form-group" style={{ marginBottom: '20px' }}>
                        <label className="input-label" htmlFor="customerName">Customer Name</label>
                        <input 
                            id="customerName" 
                            name="customerName" 
                            className="input-box" 
                            type="text" 
                            value={customerName} 
                            onChange={(e) => setCustomerName(e.target.value)} 
                            placeholder="Enter Customer Name" 
                            required 
                        />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <button type="submit" className="save-btn-modern">Add Customer</button>
                    </div>
                </form>
            </div>

            {/* Customer Dashboard */}
            <div className="cuttosheet-box">
                <h1 className="form-title-pink">Customer Dashboard</h1>
                <div style={{ overflowX: 'auto' }}>
                    <table className="result-table-modern">
                        <thead>
                            <tr>
                                <th>Customer Name</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {customers && customers.length > 0 ? customers.map(customer => (
                                <tr key={customer.id}>
                                    <td>
                                        {editingCustomer === customer.id ? (
                                            <input 
                                                type="text" 
                                                value={editName} 
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="input-box"
                                                style={{ margin: 0, width: '100%' }}
                                            />
                                        ) : (
                                            customer.customerName || customer.name
                                        )}
                                    </td>
                                    <td>
                                        {editingCustomer === customer.id ? (
                                            <div style={{ display: 'flex', gap: '5px' }}>
                                                <button 
                                                    onClick={() => handleUpdate(customer.id)}
                                                    className="save-btn-modern"
                                                    style={{ padding: '5px 10px', fontSize: '12px' }}
                                                >
                                                    Save
                                                </button>
                                                <button 
                                                    onClick={handleCancelEdit}
                                                    className="save-btn-modern"
                                                    style={{ padding: '5px 10px', fontSize: '12px', backgroundColor: '#6c757d' }}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', gap: '5px' }}>
                                                <button 
                                                    onClick={() => handleEdit(customer)}
                                                    className="save-btn-modern"
                                                    style={{ padding: '5px 10px', fontSize: '12px', backgroundColor: '#007bff' }}
                                                >
                                                    Edit
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(customer.id)}
                                                    className="save-btn-modern"
                                                    style={{ padding: '5px 10px', fontSize: '12px', backgroundColor: '#dc3545' }}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="2" style={{ textAlign: 'center' }}>No customers found</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default CustomerMaster;
