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
import LaminationMaster from './components/LaminationMaster';
import JobCard from './components/JobCard';
import UnsavedChangesPopup from './components/UnsavedChangesPopup';
import CustomCalculator from './components/CustomCalculator';

const products = [
  { name: 'CutToSheet', component: CutToSheet, section: 'products' },
  { name: 'Booklet', component: Booklet, section: 'products' },
  { name: 'Poster', component: Poster, section: 'products' },
  { name: 'Envelope', component: Envelope, section: 'products' },
  { name: 'Bag', component: Bag, section: 'products' },
  { name: 'Calendar', component: Calendar, section: 'products' },
  { name: 'Custom Calculator', component: CustomCalculator, section: 'products' },
];

const masterItems = [
  { name: 'Customer Master', component: CustomerMaster, section: 'master' },
  { name: 'Paper Type Master', component: PaperTypeMaster, section: 'master' },
  { name: 'Lamination Master', component: LaminationMaster, section: 'master' },
];

const crmItems = [
  { name: 'Job Card', component: JobCard, section: 'crm' },
];

const allItems = [...products, ...masterItems, ...crmItems];

const getStandardSize = (width, height) => {
    const sizes = {
        "8.5x11": "Letter",
        "8.5x14": "Legal",
        "11x17": "Tabloid",
        "5.5x8.5": "Half-Letter",
        "5.8x8.3": "A5",
        "8.3x11.7": "A4",
        "11.7x16.5": "A3",
        "7.1x9.5": "7.1x9.5",
        "7.1x4.75": "7.1x4.75",
        "9.5x13.5": "9.5x13.5",
        "11x11": "11x11",
        "12x12": "12x12",
        "9x9": "9x9",
    };

    const jobSize = `${width}x${height}`;
    const jobSizeReversed = `${height}x${width}`;

    if (sizes[jobSize]) {
        return sizes[jobSize];
    } else if (sizes[jobSizeReversed]) {
        return sizes[jobSizeReversed];
    } else {
        return "Custom";
    }
};

function App() {
  const [showDashboard, setShowDashboard] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [editData, setEditData] = useState(null);
  const [quotations, setQuotations] = useState([]);
  const [isCalculatorVisible, setCalculatorVisible] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [paperTypes, setPaperTypes] = useState([]);
  const [laminationTypes, setLaminationTypes] = useState([]);
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

  

  const fetchCustomers = useCallback(() => {
    fetch('/api/customers')
      .then(res => res.json())
      .then(data => {
        if (data && data.data) {
          setCustomers(data.data);
        }
      })
      .catch(error => {
        console.error('Error fetching customers:', error);
      });
  }, []);

  const fetchPaperTypes = useCallback(() => {
    fetch('/api/papertypes')
      .then(res => res.json())
      .then(data => {
        if (data && data.data) {
          setPaperTypes(data.data);
        }
      })
      .catch(error => {
        console.error('Error fetching paper types:', error);
        setPaperTypes([]);
      });
  }, []);

  const fetchLaminationTypes = useCallback(() => {
    console.log('fetchLaminationTypes called');
    fetch('/api/laminations')
      .then(res => {
        console.log('fetchLaminationTypes response status:', res.status);
        return res.json();
      })
      .then(data => {
        console.log('fetchLaminationTypes response data:', data);
        if (data && data.data) {
          console.log('Setting lamination types:', data.data);
          setLaminationTypes(data.data);
        } else {
          console.log('No data.data found in response');
        }
      })
      .catch(error => {
        console.error('Error fetching lamination types:', error);
        setLaminationTypes([]);
      });
  }, []);

  useEffect(() => {
    fetchCustomers();
    fetchPaperTypes();
    fetchLaminationTypes();
  }, [fetchCustomers, fetchPaperTypes, fetchLaminationTypes]);

  const handleAddCustomer = (customer) => {
    fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customer),
    })
    .then(response => {
      if (!response.ok) throw new Error('Failed to add customer');
      return response.json();
    })
    .then(data => {
      fetchCustomers();
    })
    .catch(error => {
      console.error('Error adding customer:', error);
    });
  };

  const handleUpdateCustomer = (customerId, customer) => {
    fetch(`/api/customers/${customerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customer),
    })
    .then(response => {
      if (!response.ok) throw new Error('Failed to update customer');
      return response.json();
    })
    .then(data => {
      fetchCustomers();
    })
    .catch(error => {
      console.error('Error updating customer:', error);
    });
  };

  const handleDeleteCustomer = (customerId) => {
    fetch(`/api/customers/${customerId}`, {
      method: 'DELETE',
    })
    .then(response => {
      if (!response.ok) throw new Error('Failed to delete customer');
      return response.json();
    })
    .then(data => {
      fetchCustomers();
    })
    .catch(error => {
      console.error('Error deleting customer:', error);
    });
  };

  const handleAddPaperType = async (paperType) => {
    try {
      const response = await fetch('/api/papertypes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paperType)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add paper type');
      }
      
      fetchPaperTypes();
    } catch (error) {
      console.error('Error adding paper type:', error);
      throw error;
    }
  };

  const handleUpdatePaperType = async (paperTypeId, paperType) => {
    try {
      const response = await fetch(`/api/papertypes/${paperTypeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paperType),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update paper type');
      }
      
      fetchPaperTypes();
    } catch (error) {
      console.error('Error updating paper type:', error);
      throw error;
    }
  };

  const handleDeletePaperType = async (paperTypeId) => {
    try {
      const response = await fetch(`/api/papertypes/${paperTypeId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete paper type');
      }
      
      fetchPaperTypes();
    } catch (error) {
      console.error('Error deleting paper type:', error);
      throw error;
    }
  };

  const handleAddLaminationType = async (laminationType) => {
    console.log('handleAddLaminationType called with:', laminationType);
    try {
      console.log('Making API call to /api/laminations');
      const response = await fetch('/api/laminations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(laminationType)
      });
      
      console.log('API response status:', response.status);
      const data = await response.json();
      console.log('API response data:', data);
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add lamination type');
      }
      
      console.log('Calling fetchLaminationTypes to refresh data');
      fetchLaminationTypes();
    } catch (error) {
      console.error('Error adding lamination type:', error);
      throw error;
    }
  };

  const handleUpdateLaminationType = async (laminationTypeId, laminationType) => {
    try {
      const response = await fetch(`/api/laminations/${laminationTypeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(laminationType),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update lamination type');
      }
      
      fetchLaminationTypes();
    } catch (error) {
      console.error('Error updating lamination type:', error);
      throw error;
    }
  };

  const handleDeleteLaminationType = async (laminationTypeId) => {
    try {
      const response = await fetch(`/api/laminations/${laminationTypeId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete lamination type');
      }
      
      fetchLaminationTypes();
    } catch (error) {
      console.error('Error deleting lamination type:', error);
      throw error;
    }
  };

  const getNextSerial = () => {
    return quotations.length > 0 ? Math.max(...quotations.map(q => q.serial || 0)) + 1 : 1;
  };

  const loadQuotations = useCallback(() => {
    fetch('/api/quotations?includeUsed=true&includeCancelled=true')
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
  }, []);

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

  const handleSaveQuotation = (savedQuotation) => {
    // If the saved quotation has an ID, it's an update.
    if (savedQuotation && savedQuotation.data && savedQuotation.data.id) {
        const updatedQuotation = {
            ...savedQuotation.data,
            // The data from the backend is nested inside a 'data' property.
            // We need to destructure it to get the actual quotation object.
            id: savedQuotation.data.id,
            productType: savedQuotation.data.productType,
            customerName: savedQuotation.data.customerName,
            inputs: savedQuotation.data.inputs,
            results: savedQuotation.data.results,
            createdAt: savedQuotation.data.createdAt,
            serial: savedQuotation.data.serial
        };

        const index = quotations.findIndex(q => q.id === updatedQuotation.id);

        if (index !== -1) {
            // Replace the old quotation with the updated one.
            const updatedQuotations = [...quotations];
            updatedQuotations[index] = updatedQuotation;
            setQuotations(updatedQuotations);
        } else {
            // If it's a new quotation, add it to the list.
            setQuotations(prev => [updatedQuotation, ...prev]);
        }
    } else {
        // Fallback to reloading all quotations if something is unexpected.
        loadQuotations();
    }

    // Reset the state and navigate back to the dashboard.
    setEditData(null);
    setShowDashboard(true);
    setSelectedProduct(null);
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
          onSaved: handleSaveQuotation, // Use the new handler
          getNextSerial: getNextSerial,
          customers: customers,
          paperTypes: paperTypes,
          onAddCustomer: handleAddCustomer,
          onAddPaperType: handleAddPaperType,
          onNavigate: handleNavigateTo,
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
        } else if (selectedProduct === 'Lamination Master') {
          componentProps = {
            laminationTypes: laminationTypes,
            onAddLaminationType: handleAddLaminationType,
            onUpdateLaminationType: handleUpdateLaminationType,
            onDeleteLaminationType: handleDeleteLaminationType,
          };
        } else if (selectedProduct === 'Job Card') {
          componentProps = {
            customers: customers,
            quotations: quotations,
            paperTypes: paperTypes,
            onSaved: handleSaveQuotation, // Corrected this line
          };
        }
      
      // Ensure all components get customers, paperTypes, and laminationTypes for dropdowns
      componentProps.customers = customers;
      componentProps.paperTypes = paperTypes;
      componentProps.laminationTypes = laminationTypes;
      
      // Add paper type handlers to all components that might need them
      if (!componentProps.onUpdatePaperType) {
        componentProps.onUpdatePaperType = handleUpdatePaperType;
        componentProps.onDeletePaperType = handleDeletePaperType;
      }
      
      // Add lamination type handlers to all components that might need them
      if (!componentProps.onAddLaminationType) {
        componentProps.onAddLaminationType = handleAddLaminationType;
        componentProps.onUpdateLaminationType = handleUpdateLaminationType;
        componentProps.onDeleteLaminationType = handleDeleteLaminationType;
      }
      
      // The ProductComponent is now rendered directly and is responsible for its own layout.
      return <ProductComponent {...componentProps} getStandardSize={getStandardSize} />;
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
                <button
                  className={`master-dropdown-item ${selectedProduct === 'Lamination Master' && !showDashboard ? 'active' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    handleSidebarNav('Lamination Master');
                  }}
                >
                  Lamination
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

          <button
            className={`dashboard-btn ${selectedProduct === 'Job Card' && !showDashboard ? 'active' : ''}`}
            onClick={() => {
              // Check if current component has unsaved changes
              if (window.currentComponentHasUnsavedChanges) {
                setPendingNavigation(() => () => {
                  handleSidebarNav('Job Card');
                });
                setShowUnsavedPopup(true);
                return;
              }
              
              handleSidebarNav('Job Card');
            }}
          >
            Job Card Dashboard
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
