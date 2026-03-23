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
    const [margin, setMargin] = useState('');
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [editName, setEditName] = useState('');
    const [editMargin, setEditMargin] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const filteredCustomers = customers.filter(customer =>
        customer.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSubmit = (e) => {
        e.preventDefault();
        onAddCustomer({ customerName, margin });
        setCustomerName('');
        setMargin('');
    };

    const handleEdit = (customer) => {
        setEditingCustomer(customer.id);
        setEditName(customer.customerName || customer.name);
        setEditMargin(customer.margin || '');
    };

    const handleUpdate = (customerId) => {
        onUpdateCustomer(customerId, { customerName: editName, margin: editMargin });
        setEditingCustomer(null);
        setEditName('');
        setEditMargin('');
    };

    const handleCancelEdit = () => {
        setEditingCustomer(null);
        setEditName('');
        setEditMargin('');
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
                    <div className="form-group" style={{ marginBottom: '20px' }}>
                        <label className="input-label" htmlFor="margin">Margin %</label>
                        <input
                            id="margin"
                            name="margin"
                            className="input-box"
                            type="number"
                            value={margin}
                            onChange={(e) => setMargin(e.target.value)}
                            placeholder="Enter Margin %"
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
                <div className="form-group" style={{ marginBottom: '20px' }}>
                    <input
                        type="text"
                        className="input-box"
                        placeholder="Search Customers..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className="result-table-modern">
                        <thead>
                            <tr>
                                <th>Customer Name</th>
                                <th>Margin %</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCustomers.length > 0 ? filteredCustomers.map(customer => (
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
                                            <input
                                                type="number"
                                                value={editMargin}
                                                onChange={(e) => setEditMargin(e.target.value)}
                                                className="input-box"
                                                style={{ margin: 0, width: '100%' }}
                                            />
                                        ) : (
                                            customer.margin
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
                                    <td colSpan="3" style={{ textAlign: 'center' }}>No customers found</td>
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
