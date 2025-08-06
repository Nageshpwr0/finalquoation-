import React, { useState } from 'react';
import '../design-system.css';

function Dashboard({ quotations, onEdit }) {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [cancelledQuotations, setCancelledQuotations] = useState(new Set());
  const pageSize = 10;

  const handleCancel = (quotationId) => {
    setCancelledQuotations(prev => new Set([...prev, quotationId]));
  };

  const getDescription = (q) => {
    if (!q) return '';
    const data = q.inputs || q || {};
    switch (q.productType) {
      case 'Calendar':
        return [
          data.calendarType ? `Type: ${data.calendarType}` : '',
          data.noOfLeaves ? `${data.noOfLeaves} leaves` : '',
          (data.jobWidth && data.jobHeight) ? `Size: ${data.jobWidth}x${data.jobHeight}` : '',
          data.gsm ? `GSM: ${data.gsm}` : ''
        ].filter(Boolean).join(', ');
      case 'Poster':
        return [
          `Size: ${data.posterSize?.split(',')[0]}`,
          `Paper: ${data.paperTypeText}`,
          data.gsm !== 'N/A' ? `GSM: ${data.gsm}` : '',
          data.lamination !== 'none' ? `Lamination: ${data.lamination}` : ''
        ].filter(Boolean).join(', ');
      case 'Bag':
         return [
          (data.width && data.height && data.spine) ? `Size: ${data.width}x${data.height}x${data.spine}` : '',
          data.gsm ? `GSM: ${data.gsm}` : '',
          data.lamination ? `Lamination: ${data.lamination}` : ''
        ].filter(Boolean).join(', ');
      case 'Envelope':
        return [
          (data.width && data.height) ? `Size: ${data.width}x${data.height}` : '',
          data.paperType ? `Paper: ${data.paperType}` : '',
          data.gsm ? `GSM: ${data.gsm}` : ''
        ].filter(Boolean).join(', ');
      case 'Booklet':
        return [
          data.paperType || '',
          data.pages ? `${data.pages} pages` : '',
          data.coverGsm ? `Cover GSM: ${data.coverGsm}` : '',
          data.bindingType ? `Binding: ${data.bindingType}` : '',
          data.paperSize || ''
        ].filter(Boolean).join(', ');
      case 'CutToSheet':
        return [
          data.qty ? `Qty: ${data.qty}` : '',
          (data.jobWidth && data.jobHeight) ? `Size: ${data.jobWidth}x${data.jobHeight}` : '',
          (data.paperTypeText || data.paperType) ? `Paper: ${data.paperTypeText || data.paperType}` : '',
          data.gsm ? `GSM: ${data.gsm}` : '',
          data.printingType ? `Printing: ${data.printingType}` : '',
          (data.lamination && data.lamination !== 'none') ? `Lamination: ${data.laminationText || data.lamination}` : ''
        ].filter(Boolean).join(', ');
      default:
        if (!data || typeof data !== 'object') return 'No description available.';
        const description = Object.entries(data)
          .map(([key, value]) => (value ? `${key}: ${value}` : ''))
          .filter(Boolean)
          .slice(0, 3)
          .join(', ');
        return description || 'No description available.';
    }
  };

  const getQty = (q) => {
    if (!q) return '';
    const data = q.inputs || q || {};
    return data.qty1 || data.quantity || data.qty || 'N/A';
  };

  const getTotalAmt = (q) => {
    if (!q) return 'N/A';
    // Check for CutToSheet structure first
    if (q.results && Array.isArray(q.results) && q.results.length > 0) {
      const firstResult = q.results[0];
      if (firstResult.totalCost) return Number(firstResult.totalCost).toFixed(2);
      if (firstResult.totalAmt) return Number(firstResult.totalAmt).toFixed(2);
      if (firstResult.totalAmount) return Number(firstResult.totalAmount).toFixed(2);
    }
    // Check for other structures
    if (q.results?.totalCost) return Number(q.results.totalCost).toFixed(2);
    if (q.results?.totalAmt) return Number(q.results.totalAmt).toFixed(2);
    if (q.results?.totalAmount) return Number(q.results.totalAmount).toFixed(2);
    if (q.results?.[0]?.finalAmount) return Number(q.results[0].finalAmount).toFixed(2);
    if (q.result?.totalAmount) return Number(q.result.totalAmount).toFixed(2);
    if (q.totalAmount) return Number(q.totalAmount).toFixed(2);
    if (q.result?.[0]?.totalCost) return Number(q.result[0].totalCost).toFixed(2);
    return 'N/A';
  };
  
  const getRate = (q) => {
    if (!q) return 'N/A';
    // Check for CutToSheet structure first
    if (q.results && Array.isArray(q.results) && q.results.length > 0) {
      const firstResult = q.results[0];
      if (firstResult.finalRate) return Number(firstResult.finalRate).toFixed(2);
      if (firstResult.ratePerPiece) return Number(firstResult.ratePerPiece).toFixed(2);
    }
    // Check for other structures
    if (q.results?.finalRate) return Number(q.results.finalRate).toFixed(2);
    if (q.results?.ratePerPiece) return Number(q.results.ratePerPiece).toFixed(2);
    if (q.results?.[0]?.bookletRate) return Number(q.results[0].bookletRate).toFixed(2);
    if (q.result?.ratePerPiece) return Number(q.result.ratePerPiece).toFixed(2);
    if (q.ratePerPiece) return Number(q.ratePerPiece).toFixed(2);
    if (q.result?.[0]?.finalRate) return Number(q.result[0].finalRate).toFixed(2);
    return 'N/A';
  };

  const getDate = (q) => {
    if (!q) return 'N/A';
    const data = q.inputs || q || {};
    const date = q.date || q.createdAt || data.date || data.createdAt;
    if (!date) return 'N/A';
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      return 'Invalid Date';
    }
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  };

  const filteredQuotations = quotations.filter((q, index) => {
    const uniqueId = `${q.serial}-${index}`;
    // Exclude cancelled quotations from search
    if (cancelledQuotations.has(uniqueId)) return false;
    
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      (q.customerName || q.inputs?.customerName || '').toLowerCase().includes(searchLower) ||
      (q.productType || '').toLowerCase().includes(searchLower) ||
      getDescription(q).toLowerCase().includes(searchLower) ||
      (q.serial || '').toString().includes(searchLower)
    );
  });

  // Show all quotations (including cancelled) for display
  const displayQuotations = quotations.filter((q, index) => {
    const uniqueId = `${q.serial}-${index}`;
    if (!searchTerm) return true;
    if (cancelledQuotations.has(uniqueId)) return true; // Show cancelled in grey
    
    const searchLower = searchTerm.toLowerCase();
    return (
      (q.customerName || q.inputs?.customerName || '').toLowerCase().includes(searchLower) ||
      (q.productType || '').toLowerCase().includes(searchLower) ||
      getDescription(q).toLowerCase().includes(searchLower) ||
      (q.serial || '').toString().includes(searchLower)
    );
  });

  return (
    <div className="dashboard-view">
      <h2 className="form-title-pink" style={{ textAlign: 'center', marginBottom: '20px' }}>Saved Quotations</h2>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <input
            type="text"
            placeholder="Search quotations..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="input-field-modern"
            style={{ 
              width: '450px', 
              height: '45px', 
              fontSize: '16px',
              padding: '12px 16px'
            }}
          />
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm('');
                setPage(1);
              }}
              className="save-btn-modern"
              style={{ padding: '12px 16px', height: '45px' }}
            >
              Clear
            </button>
          )}
        </div>
      </div>
      <div className="dashboard-table-scroll">
        <table className="result-table-modern">
          <thead>
            <tr>
              <th>Serial</th>
              <th>Customer Name</th>
              <th>Product Type</th>
              <th>Description</th>
              <th>Qty</th>
              <th>Total Amt</th>
              <th>Rate</th>
              <th>Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {displayQuotations.length === 0 ? (
              <tr><td colSpan="9" style={{ textAlign: 'center' }}>
                {searchTerm ? 'No quotations found matching your search.' : 'No quotations saved.'}
              </td></tr>
            ) : (
              displayQuotations.slice((page - 1) * pageSize, page * pageSize).map((q, i) => {
                const globalIndex = (page - 1) * pageSize + i;
                const uniqueId = `${q.serial}-${quotations.findIndex(item => item === q)}`;
                const isCancelled = cancelledQuotations.has(uniqueId);
                return (
                  <tr 
                    key={uniqueId}
                    style={{
                      backgroundColor: isCancelled ? '#f5f5f5' : 'transparent',
                      color: isCancelled ? '#999' : 'inherit',
                      opacity: isCancelled ? 0.6 : 1
                    }}
                  >
                    <td>{q.serial}</td>
                    <td>{q.customerName || (q.inputs?.customerName) || 'N/A'}</td>
                    <td>{q.productType}</td>
                    <td>{getDescription(q)}</td>
                    <td>{getQty(q)}</td>
                    <td>{getTotalAmt(q)}</td>
                    <td>{getRate(q)}</td>
                    <td>{getDate(q)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {!isCancelled && (
                          <>
                            <button className="save-btn-modern" onClick={() => onEdit(q)}>Edit</button>
                            <button 
                              className="save-btn-modern" 
                              onClick={() => handleCancel(uniqueId)}
                              style={{ backgroundColor: '#ff6b6b', borderColor: '#ff6b6b' }}
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {isCancelled && (
                          <span style={{ color: '#999', fontStyle: 'italic' }}>Cancelled</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {displayQuotations.length > pageSize && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16, gap: 8 }}>
          <button className="save-btn-modern" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
          {Array.from({ length: Math.ceil(displayQuotations.length / pageSize) }, (_, idx) => (
            <button
              key={idx + 1}
              className={`save-btn-modern${page === idx + 1 ? ' active' : ''}`}
              onClick={() => setPage(idx + 1)}
            >
              {idx + 1}
            </button>
          ))}
          <button className="save-btn-modern" disabled={page === Math.ceil(displayQuotations.length / pageSize)} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
      {searchTerm && (
        <div style={{ textAlign: 'center', marginTop: '10px', color: '#6B7280' }}>
          Showing {filteredQuotations.length} active of {quotations.length} total quotations
        </div>
      )}
    </div>
  );
}

export default Dashboard;
