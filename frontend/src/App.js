import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import CutToSheet from './components/CutToSheet';
import Dashboard from './components/Dashboard';
import Booklet from './components/Booklet';
import Poster from './components/Poster';
import Envelope from './components/Envelope';
import Bag from './components/Bag';
import Calendar from './components/Calendar';
import Calculator from './components/Calculator';
import CustomerMaster from './components/CustomerMaster';
import PaperTypeMaster from './components/PaperTypeMaster';
import JobCard from './components/JobCard';
import UnsavedChangesPopup from './components/UnsavedChangesPopup';

const products = [
  { name: 'CutToSheet', component: CutToSheet, section: 'products' },
  { name: 'Booklet', component: Booklet, section: 'products' },
  { name: 'Poster', component: Poster, section: 'products' },
  { name: 'Envelope', component: Envelope, section: 'products' },
  { name: 'Bag', component: Bag, section: 'products' },
  { name: 'Calendar', component: Calendar, section: 'products' },
];

const masterItems = [
  { name: 'Customer Master', component: CustomerMaster, section: 'master' },
  { name: 'Paper Type Master', component: PaperTypeMaster, section: 'master' },
];

const crmItems = [
  { name: 'Job Card', component: JobCard, section: 'crm' },
];

const allItems = [...products, ...masterItems, ...crmItems];

function App() {
  const [showDashboard, setShowDashboard] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [editData, setEditData] = useState(null);
  const [quotations, setQuotations] = useState([]);
  const [isCalculatorVisible, setCalculatorVisible] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [paperTypes, setPaperTypes] = useState([]);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [masterDropdownOpen, setMasterDropdownOpen] = useState(false);
  const [showUnsavedPopup, setShowUnsavedPopup] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'F2') {
        event.preventDefault();
        setCalculatorVisible(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const apiUrl = `http://${window.location.hostname}:3002`;

  const fetchCustomers = useCallback(() => {
    console.log('Fetching customers from:', `${apiUrl}/api/customers`);
    fetch(`${apiUrl}/api/customers`)
      .then(res => res.json())
      .then(data => {
        console.log('Customers fetched:', data);
        if (data && data.data) {
          setCustomers(data.data);
        }
      })
      .catch(error => {
        console.error('Error fetching customers:', error);
      });
  }, [apiUrl]);

  const fetchPaperTypes = useCallback(() => {
    console.log('Fetching paper types from:', `${apiUrl}/api/papertypes`);
    fetch(`${apiUrl}/api/papertypes`)
      .then(res => res.json())
      .then(data => {
        console.log('Paper types fetched:', data);
        if (data && data.data) {
          setPaperTypes(data.data);
        }
      })
      .catch(error => {
        console.error('Error fetching paper types:', error);
        setPaperTypes([]);
      });
  }, [apiUrl]);

  useEffect(() => {
    fetchCustomers();
    fetchPaperTypes();
  }, [fetchCustomers, fetchPaperTypes]);

  const handleAddCustomer = (customer) => {
    console.log('Adding customer:', customer);
    fetch(`${apiUrl}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customer),
    })
    .then(response => {
      if (!response.ok) throw new Error('Failed to add customer');
      return response.json();
    })
    .then(data => {
      console.log('Customer added successfully:', data);
      fetchCustomers();
    })
    .catch(error => {
      console.error('Error adding customer:', error);
    });
  };

  const handleUpdateCustomer = (customerId, customer) => {
    console.log('Updating customer:', customerId, customer);
    fetch(`${apiUrl}/api/customers/${customerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customer),
    })
    .then(response => {
      if (!response.ok) throw new Error('Failed to update customer');
      return response.json();
    })
    .then(data => {
      console.log('Customer updated successfully:', data);
      fetchCustomers();
    })
    .catch(error => {
      console.error('Error updating customer:', error);
    });
  };

  const handleDeleteCustomer = (customerId) => {
    console.log('Deleting customer:', customerId);
    fetch(`${apiUrl}/api/customers/${customerId}`, {
      method: 'DELETE',
    })
    .then(response => {
      if (!response.ok) throw new Error('Failed to delete customer');
      return response.json();
    })
    .then(data => {
      console.log('Customer deleted successfully:', data);
      fetchCustomers();
    })
    .catch(error => {
      console.error('Error deleting customer:', error);
    });
  };

  const handleAddPaperType = async (paperType) => {
    console.log('Adding paper type:', paperType);
    try {
      const response = await fetch(`${apiUrl}/api/papertypes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paperType)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add paper type');
      }
      
      console.log('Paper type added successfully:', data);
      fetchPaperTypes();
    } catch (error) {
      console.error('Error adding paper type:', error);
      throw error;
    }
  };

  const handleUpdatePaperType = async (paperTypeId, paperType) => {
    console.log('Updating paper type:', paperTypeId, paperType);
    try {
      const response = await fetch(`${apiUrl}/api/papertypes/${paperTypeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paperType),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update paper type');
      }
      
      console.log('Paper type updated successfully:', data);
      fetchPaperTypes();
    } catch (error) {
      console.error('Error updating paper type:', error);
      throw error;
    }
  };

  const handleDeletePaperType = async (paperTypeId) => {
    console.log('Deleting paper type:', paperTypeId);
    try {
      const response = await fetch(`${apiUrl}/api/papertypes/${paperTypeId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete paper type');
      }
      
      console.log('Paper type deleted successfully:', data);
      fetchPaperTypes();
    } catch (error) {
      console.error('Error deleting paper type:', error);
      throw error;
    }
  };

  const getNextSerial = () => {
    return quotations.length > 0 ? Math.max(...quotations.map(q => q.serial || 0)) + 1 : 1;
  };

  const loadQuotations = useCallback(() => {
    fetch(`${apiUrl}/api/quotations`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data?.data)) {
          setQuotations(data.data);
        } else {
          console.error("API response for quotations is not a valid array:", data);
          setQuotations([]);
        }
      })
      .catch(error => {
        console.error("Failed to load quotations:", error);
        setQuotations([]);
      });
  }, [apiUrl]);

  useEffect(() => {
    if (showDashboard) {
      loadQuotations();
    }
  }, [showDashboard, loadQuotations]);

  const handleEdit = (quotation) => {
    setEditData(quotation);
    setSelectedProduct(quotation.productType);
    setShowDashboard(false);
  };

  const handleFormSaved = () => {
    setEditData(null);
    setShowDashboard(true);
    setSelectedProduct(null);
    loadQuotations();
  };

  const handleSidebarNav = (productName) => {
    // Check if current component has unsaved changes
    if (window.currentComponentHasUnsavedChanges) {
      setPendingNavigation(() => () => {
        setShowDashboard(false);
        setSelectedProduct(productName);
        setEditData(null);
        if (window.innerWidth <= 1024) {
          setMobileSidebarOpen(false);
        }
      });
      setShowUnsavedPopup(true);
      return;
    }
    
    setShowDashboard(false);
    setSelectedProduct(productName);
    setEditData(null);
    if (window.innerWidth <= 1024) {
      setMobileSidebarOpen(false);
    }
  };

  const handleUnsavedSave = () => {
    if (window.saveCurrentForm) {
      window.saveCurrentForm();
    }
    setShowUnsavedPopup(false);
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  };

  const handleUnsavedDiscard = () => {
    setShowUnsavedPopup(false);
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  };

  const handleUnsavedCancel = () => {
    setShowUnsavedPopup(false);
    setPendingNavigation(null);
  };

  const handleNavigateTo = (productName) => {
    handleSidebarNav(productName);
  };

  const renderContent = () => {
    if (showDashboard) {
      return <Dashboard quotations={quotations} onEdit={handleEdit} />;
    }

    const ProductComponent = allItems.find(p => p.name === selectedProduct)?.component;

    if (ProductComponent) {
      let componentProps = {
        formData: editData,
        onSaved: handleFormSaved,
        getNextSerial: getNextSerial,
        customers: customers,
        paperTypes: paperTypes,
        onAddCustomer: handleAddCustomer,
        onAddPaperType: handleAddPaperType,
        onNavigate: handleNavigateTo,
        apiUrl: apiUrl,
      };
      
      // Special props for master components
      if (selectedProduct === 'Customer Master') {
        componentProps = {
          customers: customers,
          onAddCustomer: handleAddCustomer,
          onUpdateCustomer: handleUpdateCustomer,
          onDeleteCustomer: handleDeleteCustomer,
        };
      } else if (selectedProduct === 'Paper Type Master') {
        componentProps = {
          paperTypes: paperTypes,
          onAddPaperType: handleAddPaperType,
          onUpdatePaperType: handleUpdatePaperType,
          onDeletePaperType: handleDeletePaperType,
        };
      } else if (selectedProduct === 'Job Card') {
        componentProps = {
          customers: customers,
          quotations: quotations,
          paperTypes: paperTypes,
          apiUrl: apiUrl,
          onSaved: handleFormSaved,
        };
      }
      
      // Ensure all components get customers and paperTypes for dropdowns
      componentProps.customers = customers;
      componentProps.paperTypes = paperTypes;
      
      // Add paper type handlers to all components that might need them
      if (!componentProps.onUpdatePaperType) {
        componentProps.onUpdatePaperType = handleUpdatePaperType;
        componentProps.onDeletePaperType = handleDeletePaperType;
      }
      
      // The ProductComponent is now rendered directly and is responsible for its own layout.
      return <ProductComponent {...componentProps} />;
    }
    
    return null; // Don't render anything if no product is selected
  };

  return (
    <div className={`crm-app ${!desktopSidebarOpen ? 'sidebar-collapsed' : ''}`}>
      <aside className={`crm-sidebar ${mobileSidebarOpen ? 'open' : ''}`}>
        <div className="crm-logo">
          <img src="/4.png" alt="Company Logo" />
        </div>
        <nav className="crm-nav">
          <div className="nav-section">
            <h4 className="nav-section-title">Products</h4>
            {products.map((product) => (
              <button
                key={product.name}
                className={`crm-nav-link ${selectedProduct === product.name && !showDashboard ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  handleSidebarNav(product.name);
                }}
              >
                <span className="nav-text">{product.name}</span>
              </button>
            ))}
          </div>
          <div className="nav-section">
            <h4 className="nav-section-title">CRM</h4>
            <button
              className={`crm-nav-link ${selectedProduct === 'Job Card' && !showDashboard ? 'active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                handleSidebarNav('Job Card');
              }}
            >
              <span className="nav-text">Job Card</span>
            </button>
          </div>
          <div className="nav-section">
            <div className="master-dropdown">
              <button
                className={`master-toggle ${masterItems.some(item => selectedProduct === item.name && !showDashboard) ? 'active' : ''}`}
                onClick={() => setMasterDropdownOpen(!masterDropdownOpen)}
              >
                <span>Master</span>
                <span className={`dropdown-arrow ${masterDropdownOpen ? 'open' : ''}`}>▼</span>
              </button>
              <div className={`master-dropdown-content ${masterDropdownOpen ? 'open' : ''}`}>
                <button
                  className={`master-dropdown-item ${selectedProduct === 'Customer Master' && !showDashboard ? 'active' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    handleSidebarNav('Customer Master');
                  }}
                >
                  Customer
                </button>
                <button
                  className={`master-dropdown-item ${selectedProduct === 'Paper Type Master' && !showDashboard ? 'active' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    handleSidebarNav('Paper Type Master');
                  }}
                >
                  Paper Type
                </button>

              </div>
            </div>
          </div>
        </nav>
      </aside>

      {mobileSidebarOpen && <div className="crm-sidebar-overlay" onClick={() => setMobileSidebarOpen(false)}></div>}

      <main className="crm-main">
        <header className="crm-header">
          <button className="sidebar-toggle-btn" onClick={() => setDesktopSidebarOpen(!desktopSidebarOpen)}>&#9776;</button>
          <button className="mobile-menu-btn" onClick={() => setMobileSidebarOpen(true)}>&#9776;</button>
          
          <button
            className={`dashboard-btn ${showDashboard ? 'active' : ''}`}
            onClick={() => {
              // Check if current component has unsaved changes
              if (window.currentComponentHasUnsavedChanges) {
                setPendingNavigation(() => () => {
                  setShowDashboard(true);
                  setSelectedProduct(null);
                });
                setShowUnsavedPopup(true);
                return;
              }
              
              setShowDashboard(true);
              setSelectedProduct(null);
            }}
          >
            Dashboard
          </button>

          <div className="header-actions">
            <button className="dashboard-btn" onClick={() => setCalculatorVisible(true)}>Calculator</button>
            <a href="https://web.whatsapp.com/" target="_blank" rel="noopener noreferrer" className="dashboard-btn">WhatsApp</a>
          </div>
        </header>
        
        <section className="crm-content-area">
          {renderContent()}
        </section>
      </main>
      <Calculator isVisible={isCalculatorVisible} onClose={() => setCalculatorVisible(false)} />
      <UnsavedChangesPopup 
        isVisible={showUnsavedPopup}
        message="You have unsaved changes. What would you like to do?"
        type="warning"
        onSave={handleUnsavedSave}
        onDiscard={handleUnsavedDiscard}
        onCancel={handleUnsavedCancel}
      />
    </div>
  );
}

export default App;
