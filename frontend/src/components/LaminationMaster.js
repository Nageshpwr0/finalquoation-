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
if (!document.querySelector('#lamination-master-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'lamination-master-styles';
    styleSheet.textContent = additionalStyles;
    document.head.appendChild(styleSheet);
}

const LaminationMaster = ({ laminationTypes, onAddLaminationType, onUpdateLaminationType, onDeleteLaminationType }) => {
    const [laminationName, setLaminationName] = useState('');
    const [rate, setRate] = useState('');
    const [editingLaminationType, setEditingLaminationType] = useState(null);
    const [editData, setEditData] = useState({});
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log('Submitting lamination type:', { laminationName, rate });
        try {
            await onAddLaminationType({ laminationName, rate });
            console.log('Lamination type added successfully');
            setLaminationName('');
            setRate('');
            setSuccessMessage('Lamination type added successfully!');
            setErrorMessage('');
        } catch (error) {
            console.error('Error adding lamination type:', error);
            setErrorMessage('Failed to add lamination type: ' + error.message);
            setSuccessMessage('');
        }
    };

    const handleEdit = (laminationType) => {
        setEditingLaminationType(laminationType.id);
        setEditData({
            laminationName: laminationType.laminationName,
            rate: laminationType.rate
        });
    };

    const handleUpdate = async (laminationTypeId) => {
        try {
            setErrorMessage('');
            setSuccessMessage('');
            
            if (onUpdateLaminationType) {
                await onUpdateLaminationType(laminationTypeId, editData);
                setSuccessMessage('Lamination type updated successfully!');
                setTimeout(() => setSuccessMessage(''), 3000);
            }
            setEditingLaminationType(null);
            setEditData({});
        } catch (error) {
            setErrorMessage(error.message || 'Failed to update lamination type');
            setTimeout(() => setErrorMessage(''), 5000);
        }
    };

    const handleCancelEdit = () => {
        setEditingLaminationType(null);
        setEditData({});
    };

    const handleDelete = async (laminationTypeId) => {
        if (window.confirm('Are you sure you want to delete this lamination type?')) {
            try {
                setErrorMessage('');
                setSuccessMessage('');
                
                if (onDeleteLaminationType) {
                    await onDeleteLaminationType(laminationTypeId);
                    setSuccessMessage('Lamination type deleted successfully!');
                    setTimeout(() => setSuccessMessage(''), 3000);
                }
            } catch (error) {
                setErrorMessage(error.message || 'Failed to delete lamination type');
                setTimeout(() => setErrorMessage(''), 5000);
            }
        }
    };

    const handleEditChange = (field, value) => {
        setEditData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div style={{ padding: '20px' }}>
            {/* Lamination Type Master Form */}
            <div className="cuttosheet-box" style={{ marginBottom: '30px' }}>
                <h1 className="form-title-pink">Lamination Master</h1>
                <form onSubmit={handleSubmit}>
                    <div className="form-grid-modern">
                        <div className="form-group">
                            <label className="input-label" htmlFor="laminationName">Lamination Name</label>
                            <input 
                                id="laminationName" 
                                name="laminationName" 
                                className="input-box" 
                                type="text" 
                                value={laminationName} 
                                onChange={(e) => setLaminationName(e.target.value)} 
                                placeholder="Lamination Name" 
                                required 
                            />
                        </div>
                        <div className="form-group">
                            <label className="input-label" htmlFor="rate">Rate</label>
                            <input 
                                id="rate" 
                                name="rate" 
                                className="input-box" 
                                type="number" 
                                step="0.01"
                                value={rate} 
                                onChange={(e) => setRate(e.target.value)} 
                                placeholder="Rate" 
                            />
                        </div>
                    </div>
                    <div style={{ textAlign: 'center', marginTop: '20px' }}>
                        <button type="submit" className="save-btn-modern">Add Lamination Type</button>
                    </div>
                </form>
            </div>

            {/* Lamination Type Dashboard */}
            <div className="cuttosheet-box">
                <h1 className="form-title-pink">Lamination Dashboard</h1>
                
                {/* Error/Success Messages */}
                {errorMessage && (
                    <div style={{ 
                        backgroundColor: '#fee', 
                        border: '1px solid #fcc', 
                        color: '#c33', 
                        padding: '10px', 
                        borderRadius: '4px', 
                        marginBottom: '15px' 
                    }}>
                        {errorMessage}
                    </div>
                )}
                
                {successMessage && (
                    <div style={{ 
                        backgroundColor: '#efe', 
                        border: '1px solid #cfc', 
                        color: '#363', 
                        padding: '10px', 
                        borderRadius: '4px', 
                        marginBottom: '15px' 
                    }}>
                        {successMessage}
                    </div>
                )}
                
                <div style={{ overflowX: 'auto' }}>
                    <table className="result-table-modern">
                        <thead>
                            <tr>
                                <th>Lamination Name</th>
                                <th>Rate</th>
                                <th>Usage</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {laminationTypes && laminationTypes.length > 0 ? laminationTypes.map(laminationType => (
                                <tr key={laminationType.id}>
                                    <td>
                                        {editingLaminationType === laminationType.id ? (
                                            <input 
                                                type="text" 
                                                value={editData.laminationName || ''} 
                                                onChange={(e) => handleEditChange('laminationName', e.target.value)}
                                                className="input-box"
                                                style={{ margin: 0, width: '100%' }}
                                            />
                                        ) : (
                                            laminationType.laminationName
                                        )}
                                    </td>
                                    <td>
                                        {editingLaminationType === laminationType.id ? (
                                            <input 
                                                type="number" 
                                                step="0.01"
                                                value={editData.rate || ''} 
                                                onChange={(e) => handleEditChange('rate', e.target.value)}
                                                className="input-box"
                                                style={{ margin: 0, width: '100%' }}
                                            />
                                        ) : (
                                            laminationType.rate
                                        )}
                                    </td>
                                    <td>
                                        {laminationType.usedInQuotations > 0 ? (
                                            <span style={{ color: '#dc3545', fontSize: '12px' }}>
                                                Used in {laminationType.usedInQuotations} quotation(s)
                                            </span>
                                        ) : (
                                            <span style={{ color: '#28a745', fontSize: '12px' }}>Not used</span>
                                        )}
                                    </td>
                                    <td>
                                        {editingLaminationType === laminationType.id ? (
                                            <div style={{ display: 'flex', gap: '5px' }}>
                                                <button 
                                                    onClick={() => handleUpdate(laminationType.id)}
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
                                                    onClick={() => handleEdit(laminationType)}
                                                    className="save-btn-modern"
                                                    style={{ 
                                                        padding: '5px 10px', 
                                                        fontSize: '12px', 
                                                        backgroundColor: laminationType.usedInQuotations > 0 ? '#6c757d' : '#007bff',
                                                        cursor: laminationType.usedInQuotations > 0 ? 'not-allowed' : 'pointer'
                                                    }}
                                                    disabled={laminationType.usedInQuotations > 0}
                                                    title={laminationType.usedInQuotations > 0 ? 'Cannot edit - used in quotations' : 'Edit lamination type'}
                                                >
                                                    Edit
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(laminationType.id)}
                                                    className="save-btn-modern"
                                                    style={{ 
                                                        padding: '5px 10px', 
                                                        fontSize: '12px', 
                                                        backgroundColor: laminationType.usedInQuotations > 0 ? '#6c757d' : '#dc3545',
                                                        cursor: laminationType.usedInQuotations > 0 ? 'not-allowed' : 'pointer'
                                                    }}
                                                    disabled={laminationType.usedInQuotations > 0}
                                                    title={laminationType.usedInQuotations > 0 ? 'Cannot delete - used in quotations' : 'Delete lamination type'}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="4" style={{ textAlign: 'center' }}>No lamination types found</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default LaminationMaster;