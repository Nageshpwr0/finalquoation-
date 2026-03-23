import React, { useState, useEffect } from 'react';
import { generatePdf } from './JobCardPDF';
import '../design-system.css';

function JobCardList({ apiUrl, refreshTrigger, onEdit, laminationTypes }) {
  const [jobCards, setJobCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    fetchJobCards();
  }, [apiUrl, refreshTrigger]);

  const fetchJobCards = async () => {
    try {
      const response = await fetch('/api/jobcards');
      const data = await response.json();
      if (data && data.data) {
        setJobCards(data.data);
      } else {
        setJobCards([]);
      }
    } catch (error) {
      console.error('Error fetching job cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = (jobCard) => {
    console.log('handlePrint called with jobCard:', jobCard);
    let quotationDetails = null;

    // The quotationDetails from the database is a JSON string.
    // We need to parse it to be used in the PDF generation.
    if (jobCard.quotationDetails && typeof jobCard.quotationDetails === 'string') {
      try {
        quotationDetails = JSON.parse(jobCard.quotationDetails);
        console.log('Parsed quotation details from job card:', quotationDetails);
      } catch (error) {
        console.error('Error parsing quotationDetails JSON:', error);
      }
    } else if (jobCard.quotationDetails) {
      // If it's already an object, use it directly.
      quotationDetails = jobCard.quotationDetails;
    }

    generatePdf({ ...jobCard, quotationDetails }, laminationTypes);
  };

  const filteredJobCards = jobCards.filter(jobCard => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      (jobCard.jobCardNum || '').toLowerCase().includes(searchLower) ||
      (jobCard.customerName || '').toLowerCase().includes(searchLower) ||
      (jobCard.jobName || '').toLowerCase().includes(searchLower) ||
      (jobCard.productName || '').toLowerCase().includes(searchLower)
    );
  });

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'most_urgent': return '#ff4444';
      case 'urgent': return '#ff8800';
      case 'regular': return '#28a745';
      default: return '#6c757d';
    }
  };

  if (loading) {
    return <div className="form-container-modern">Loading job cards...</div>;
  }

  return (
    <div className="dashboard-view">
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <input
            type="text"
            placeholder="Search job cards..."
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
              <th>Job Card #</th>
              <th>Customer</th>
              <th>Job Name</th>
              <th>Product</th>
              <th style={{ width: '80px' }}>Image</th>
              <th>Machine</th>
              <th>Quotation #</th>
              <th>Priority</th>
              <th>Job Type</th>
              <th>Billing Type</th>
              <th>Created Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredJobCards.length === 0 ? (
              <tr>
                <td colSpan="12" style={{ textAlign: 'center' }}>
                  {searchTerm ? 'No job cards found matching your search.' : 'No job cards created yet.'}
                </td>
              </tr>
            ) : (
              filteredJobCards.slice((page - 1) * pageSize, page * pageSize).map((jobCard) => {
                const machines = jobCard.processDetails?.map(p => p.machine).filter(m => m).join(', ') || 'N/A';
                return (
                  <tr key={jobCard.id}>
                    <td><strong>{jobCard.jobCardNum}</strong></td>
                    <td>{jobCard.customerName}</td>
                    <td>{jobCard.jobName}</td>
                    <td>{jobCard.productName}</td>
                    <td style={{ position: 'relative', width: '80px' }}>
                      {jobCard.imageData ? (
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <img 
                            src={jobCard.imageData} 
                            alt={jobCard.imageAttached || 'Job image'}
                            style={{ 
                              width: '80px', 
                              height: '60px', 
                              objectFit: 'cover', 
                              borderRadius: '4px',
                              cursor: 'pointer',
                              border: '1px solid #ddd'
                            }}
                            title={`Click to view: ${jobCard.imageAttached || 'Job image'}`}
                            onClick={() => window.open(jobCard.imageData, '_blank')}
                            onMouseEnter={(e) => {
                              const preview = document.createElement('img');
                              preview.src = jobCard.imageData;
                              preview.style.cssText = `
                                position: fixed;
                                width: 200px;
                                height: 200px;
                                object-fit: cover;
                                border: 2px solid #333;
                                border-radius: 8px;
                                z-index: 1000;
                                pointer-events: none;
                                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                              `;
                              preview.id = 'image-preview';
                              document.body.appendChild(preview);
                              
                              const updatePosition = (event) => {
                                preview.style.left = (event.clientX + 10) + 'px';
                                preview.style.top = (event.clientY + 10) + 'px';
                              };
                              updatePosition(e);
                              e.target.addEventListener('mousemove', updatePosition);
                            }}
                            onMouseLeave={(e) => {
                              const preview = document.getElementById('image-preview');
                              if (preview) preview.remove();
                              e.target.removeEventListener('mousemove', () => {});
                            }}
                          />
                        </div>
                      ) : (
                        <span style={{ color: jobCard.imageAttached ? '#28a745' : '#dc3545' }}>
                          {jobCard.imageAttached ? '✓' : '✗'}
                        </span>
                      )}
                    </td>
                    <td>{machines}</td>
                    <td>{jobCard.quotationNumber || 'N/A'}</td>
                    <td>
                      <span 
                        style={{ 
                          color: getPriorityColor(jobCard.priority),
                          fontWeight: 'bold',
                          textTransform: 'capitalize'
                        }}
                      >
                        {jobCard.priority?.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{jobCard.jobType}</td>
                    <td style={{ textTransform: 'capitalize' }}>{jobCard.billingType}</td>
                    <td>{formatDate(jobCard.createdAt)}</td>
                    <td>
                      <button 
                        onClick={() => onEdit(jobCard)}
                        className="save-btn-modern"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handlePrint(jobCard)}
                        className="save-btn-modern"
                        style={{ marginLeft: '8px' }}
                      >
                        Print
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      

      {filteredJobCards.length > pageSize && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16, gap: 8 }}>
          <button 
            className="save-btn-modern" 
            disabled={page === 1} 
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          {Array.from({ length: Math.ceil(filteredJobCards.length / pageSize) }, (_, idx) => (
            <button
              key={idx + 1}
              className={`save-btn-modern${page === idx + 1 ? ' active' : ''}`}
              onClick={() => setPage(idx + 1)}
            >
              {idx + 1}
            </button>
          ))}
          <button 
            className="save-btn-modern" 
            disabled={page === Math.ceil(filteredJobCards.length / pageSize)} 
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}

      {searchTerm && (
        <div style={{ textAlign: 'center', marginTop: '10px', color: '#6B7280' }}>
          Showing {filteredJobCards.length} of {jobCards.length} job cards
        </div>
      )}
    </div>
  );
}

export default JobCardList;
