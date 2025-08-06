import React, { useState, useEffect, useCallback } from 'react';
import '../design-system.css';

const Calculator = ({ isVisible, onClose }) => {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [displayFontSize, setDisplayFontSize] = useState('3rem');
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart]);

  useEffect(() => {
    const len = input.length;
    if (len > 20) {
      setDisplayFontSize('1.5rem');
    } else if (len > 15) {
      setDisplayFontSize('2rem');
    } else if (len > 10) {
      setDisplayFontSize('2.5rem');
    } else {
      setDisplayFontSize('3rem');
    }
  }, [input]);

  const evaluate = (expression) => {
    // This is a safer way to evaluate expressions.
    // It handles basic arithmetic operations.
    // For more complex scenarios, a dedicated library would be better.
    try {
      return new Function('return ' + expression)();
    } catch (error) {
      return 'Error';
    }
  };

  const handleButtonClick = useCallback((value) => {
    if (value === 'AC') {
      setInput('');
    } else if (value === 'C') {
      setInput(prev => prev.slice(0, -1));
    }
    // --- ADDED THIS BLOCK TO HANDLE PERCENTAGE ---
    else if (value === '%') {
      if (input === '' || isNaN(Number(input))) return;
      try {
        const result = (Number(input) / 100).toString();
        setInput(result);
      } catch {
        setInput('Error');
      }
    }
    // --- END OF ADDED BLOCK ---
    else if (value === '=') {
      if (input === '' || input === 'Error') return;
      try {
        if (input.length > 100) {
          setInput('Error: Expression too long');
          return;
        }

        const validChars = /^[0-9+\-*/().\s]*$/;
        if (!validChars.test(input)) {
          setInput('Error: Invalid Characters');
          return;
        }

        const result = evaluate(input).toString();
        if (result !== 'Error') {
          setHistory(prev => [...prev, { expression: input, result }]);
          setInput(result);
        } else {
          setInput('Error');
        }
      } catch (error) {
        setInput('Error');
      }
    } else {
      if (input === 'Error') {
        setInput(value);
      } else {
        setInput(prev => prev + value);
      }
    }
  }, [input]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!isVisible) return;
      
      const { key } = event;
      
      if ((key >= '0' && key <= '9') || ['+', '-', '*', '/', '.', '%'].includes(key) || key === 'Enter' || key === '=' || key === 'Backspace' || key.toLowerCase() === 'c' || key === 'Delete' || key === 'Escape') {
        event.preventDefault();
      }

      if (key >= '0' && key <= '9') {
        handleButtonClick(key);
      } else if (['+', '-', '*', '/', '%'].includes(key)) {
        handleButtonClick(key);
      } else if (key === '.') {
        handleButtonClick(key);
      } else if (key === 'Enter' || key === '=') {
        handleButtonClick('=');
      } else if (key === 'Backspace') {
        handleButtonClick('C');
      } else if (key.toLowerCase() === 'c' || key === 'Delete') {
        handleButtonClick('AC');
      } else if (key === 'Escape') {
        setInput('');
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, handleButtonClick, onClose]);


  if (!isVisible) return null;

  return (
    <div 
      className="calculator-popup cuttosheet-box" 
      style={{ 
        position: 'fixed', 
        top: position.y || '50%', 
        left: position.x || '50%', 
        transform: position.x || position.y ? 'none' : 'translate(-50%, -50%)',
        zIndex: 1000
      }}
    >
      <div 
        className="calculator-header" 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          borderBottom: '1px solid #E5E7EB', 
          paddingBottom: '10px', 
          marginBottom: '10px',
          cursor: 'move'
        }}
        onMouseDown={handleMouseDown}
      >
        <span className="form-title-pink" style={{margin: 0, padding: 0, border: 'none'}}>Calculator</span>
        <div className="header-controls" style={{display: 'flex', gap: '10px'}}>
          <button className="save-btn-modern" onClick={() => setShowHistory(!showHistory)}>
            {showHistory ? 'Calc' : 'History'}
          </button>
          <button className="save-btn-modern" onClick={onClose}>&times;</button>
        </div>
      </div>
      {showHistory ? (
        <div className="history-panel" style={{minHeight: '280px', padding: '10px', border: '1px solid #E5E7EB', borderRadius: '6px', background: '#F9FAFB'}}>
          <h3 style={{textAlign: 'center', marginBottom: '10px'}}>History</h3>
          {history.length === 0 ? (
            <div style={{textAlign: 'center', color: '#6B7280'}}>No history yet.</div>
          ) : (
            <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
              {history.map((item, index) => (
                <li key={index} style={{borderBottom: '1px solid #E5E7EB', padding: '5px 0', textAlign: 'right'}}>
                  <div style={{fontSize: '0.8rem', color: '#6B7280'}}>{item.expression} =</div>
                  <div style={{fontSize: '1.2rem', fontWeight: 'bold'}}>{item.result}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div>
          <div className="calculator-screen" style={{ fontSize: displayFontSize, background: '#F9FAFB', border: '1px solid #D1D5DB', borderRadius: '6px', padding: '10px', textAlign: 'right', marginBottom: '15px', minHeight: '60px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {input || '0'}
          </div>
          <div className="calculator-keys" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            {['AC', 'C', '%', '/'].map(item => <button key={item} className="save-btn-modern" style={{padding: '20px', fontSize: '1.2rem'}} onClick={() => handleButtonClick(item)}>{item}</button>)} 
            {['7', '8', '9', '*'].map(item => <button key={item} className="save-btn-modern" style={{padding: '20px', fontSize: '1.2rem'}} onClick={() => handleButtonClick(item)}>{item}</button>)} 
            {['4', '5', '6', '-'].map(item => <button key={item} className="save-btn-modern" style={{padding: '20px', fontSize: '1.2rem'}} onClick={() => handleButtonClick(item)}>{item}</button>)} 
            {['1', '2', '3', '+'].map(item => <button key={item} className="save-btn-modern" style={{padding: '20px', fontSize: '1.2rem'}} onClick={() => handleButtonClick(item)}>{item}</button>)} 
            {['0', '.', '='].map(item => <button key={item} className={`save-btn-modern ${item === '=' ? 'equals' : ''} ${item === '0' ? 'zero' : ''}`} style={{padding: '20px', fontSize: '1.2rem', gridColumn: item === '0' ? 'span 2' : ''}} onClick={() => handleButtonClick(item)}>{item}</button>)} 
          </div>
        </div>
      )}
    </div>
  );
};

export default Calculator;
