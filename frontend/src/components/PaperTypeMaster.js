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
if (!document.querySelector('#paper-type-master-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'paper-type-master-styles';
    styleSheet.textContent = additionalStyles;
    document.head.appendChild(styleSheet);
}

const PaperTypeMaster = ({ paperTypes, onAddPaperType, onUpdatePaperType, onDeletePaperType }) => {
    const [paperTypeName, setPaperTypeName] = useState('');
    const [ratePerKg, setRatePerKg] = useState('');
    const [minGsm, setMinGsm] = useState('');
    const [maxGsm, setMaxGsm] = useState('');
    const [editingPaperType, setEditingPaperType] = useState(null);
    const [editData, setEditData] = useState({});
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        onAddPaperType({ paperTypeName, ratePerKg, minGsm, maxGsm });
        setPaperTypeName('');
        setRatePerKg('');
        setMinGsm('');
        setMaxGsm('');
    };

    const handleEdit = (paperType) => {
        setEditingPaperType(paperType.id);
        setEditData({
            paperTypeName: paperType.paperTypeName,
            ratePerKg: paperType.ratePerKg,
            minGsm: paperType.minGsm,
            maxGsm: paperType.maxGsm
        });
    };

    const handleUpdate = async (paperTypeId) => {
        try {
            setErrorMessage('');
            setSuccessMessage('');
            
            if (onUpdatePaperType) {
                await onUpdatePaperType(paperTypeId, editData);
                setSuccessMessage('Paper type updated successfully!');
                setTimeout(() => setSuccessMessage(''), 3000);
            }
            setEditingPaperType(null);
            setEditData({});
        } catch (error) {
            setErrorMessage(error.message || 'Failed to update paper type');
            setTimeout(() => setErrorMessage(''), 5000);
        }
    };

    const handleCancelEdit = () => {
        setEditingPaperType(null);
        setEditData({});
    };

    const handleDelete = async (paperTypeId) => {
        if (window.confirm('Are you sure you want to delete this paper type?')) {
            try {
                setErrorMessage('');
                setSuccessMessage('');
                
                if (onDeletePaperType) {
                    await onDeletePaperType(paperTypeId);
                    setSuccessMessage('Paper type deleted successfully!');
                    setTimeout(() => setSuccessMessage(''), 3000);
                }
            } catch (error) {
                setErrorMessage(error.message || 'Failed to delete paper type');
                setTimeout(() => setErrorMessage(''), 5000);
            }
        }
    };

    const handleEditChange = (field, value) => {
        setEditData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div style={{ padding: '20px' }}>
            {/* Paper Type Master Form */}
            <div className="cuttosheet-box" style={{ marginBottom: '30px' }}>
                <h1 className="form-title-pink">Paper Type Master</h1>
                <form onSubmit={handleSubmit}>
                    <div className="form-grid-modern">
                        <div className="form-group">
                            <label className="input-label" htmlFor="paperTypeName">Paper Type Name</label>
                            <input 
                                id="paperTypeName" 
                                name="paperTypeName" 
                                className="input-box" 
                                type="text" 
                                value={paperTypeName} 
                                onChange={(e) => setPaperTypeName(e.target.value)} 
                                placeholder="Paper Type Name" 
                                required 
                            />
                        </div>
                        <div className="form-group">
                            <label className="input-label" htmlFor="ratePerKg">Rate Per Kg</label>
                            <input 
                                id="ratePerKg" 
                                name="ratePerKg" 
                                className="input-box" 
                                type="number" 
                                value={ratePerKg} 
                                onChange={(e) => setRatePerKg(e.target.value)} 
                                placeholder="Rate Per Kg" 
                            />
                        </div>
                        <div className="form-group">
                            <label className="input-label" htmlFor="minGsm">Min GSM</label>
                            <input 
                                id="minGsm" 
                                name="minGsm" 
                                className="input-box" 
                                type="number" 
                                value={minGsm} 
                                onChange={(e) => setMinGsm(e.target.value)} 
                                placeholder="Min GSM" 
                            />
                        </div>
                        <div className="form-group">
                            <label className="input-label" htmlFor="maxGsm">Max GSM</label>
                            <input 
                                id="maxGsm" 
                                name="maxGsm" 
                                className="input-box" 
                                type="number" 
                                value={maxGsm} 
                                onChange={(e) => setMaxGsm(e.target.value)} 
                                placeholder="Max GSM" 
                            />
                        </div>
                    </div>
                    <div style={{ textAlign: 'center', marginTop: '20px' }}>
                        <button type="submit" className="save-btn-modern">Add Paper Type</button>
                    </div>
                </form>
            </div>

            {/* Paper Type Dashboard */}
            <div className="cuttosheet-box">
                <h1 className="form-title-pink">Paper Type Dashboard</h1>
                
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
                                <th>Name</th>
                                <th>Rate/Kg</th>
                                <th>Min GSM</th>
                                <th>Max GSM</th>
                                <th>Usage</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paperTypes && paperTypes.length > 0 ? paperTypes.map(paperType => (
                                <tr key={paperType.id}>
                                    <td>
                                        {editingPaperType === paperType.id ? (
                                            <input 
                                                type="text" 
                                                value={editData.paperTypeName || ''} 
                                                onChange={(e) => handleEditChange('paperTypeName', e.target.value)}
                                                className="input-box"
                                                style={{ margin: 0, width: '100%' }}
                                            />
                                        ) : (
                                            paperType.paperTypeName
                                        )}
                                    </td>
                                    <td>
                                        {editingPaperType === paperType.id ? (
                                            <input 
                                                type="number" 
                                                value={editData.ratePerKg || ''} 
                                                onChange={(e) => handleEditChange('ratePerKg', e.target.value)}
                                                className="input-box"
                                                style={{ margin: 0, width: '100%' }}
                                            />
                                        ) : (
                                            paperType.ratePerKg
                                        )}
                                    </td>
                                    <td>
                                        {editingPaperType === paperType.id ? (
                                            <input 
                                                type="number" 
                                                value={editData.minGsm || ''} 
                                                onChange={(e) => handleEditChange('minGsm', e.target.value)}
                                                className="input-box"
                                                style={{ margin: 0, width: '100%' }}
                                            />
                                        ) : (
                                            paperType.minGsm
                                        )}
                                    </td>
                                    <td>
                                        {editingPaperType === paperType.id ? (
                                            <input 
                                                type="number" 
                                                value={editData.maxGsm || ''} 
                                                onChange={(e) => handleEditChange('maxGsm', e.target.value)}
                                                className="input-box"
                                                style={{ margin: 0, width: '100%' }}
                                            />
                                        ) : (
                                            paperType.maxGsm
                                        )}
                                    </td>
                                    <td>
                                        {paperType.usedInQuotations > 0 ? (
                                            <span style={{ color: '#dc3545', fontSize: '12px' }}>
                                                Used in {paperType.usedInQuotations} quotation(s)
                                            </span>
                                        ) : (
                                            <span style={{ color: '#28a745', fontSize: '12px' }}>Not used</span>
                                        )}
                                    </td>
                                    <td>
                                        {editingPaperType === paperType.id ? (
                                            <div style={{ display: 'flex', gap: '5px' }}>
                                                <button 
                                                    onClick={() => handleUpdate(paperType.id)}
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
                                                    onClick={() => handleEdit(paperType)}
                                                    className="save-btn-modern"
                                                    style={{ 
                                                        padding: '5px 10px', 
                                                        fontSize: '12px', 
                                                        backgroundColor: paperType.usedInQuotations > 0 ? '#6c757d' : '#007bff',
                                                        cursor: paperType.usedInQuotations > 0 ? 'not-allowed' : 'pointer'
                                                    }}
                                                    disabled={paperType.usedInQuotations > 0}
                                                    title={paperType.usedInQuotations > 0 ? 'Cannot edit - used in quotations' : 'Edit paper type'}
                                                >
                                                    Edit
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(paperType.id)}
                                                    className="save-btn-modern"
                                                    style={{ 
                                                        padding: '5px 10px', 
                                                        fontSize: '12px', 
                                                        backgroundColor: paperType.usedInQuotations > 0 ? '#6c757d' : '#dc3545',
                                                        cursor: paperType.usedInQuotations > 0 ? 'not-allowed' : 'pointer'
                                                    }}
                                                    disabled={paperType.usedInQuotations > 0}
                                                    title={paperType.usedInQuotations > 0 ? 'Cannot delete - used in quotations' : 'Delete paper type'}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center' }}>No paper types found</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PaperTypeMaster;
