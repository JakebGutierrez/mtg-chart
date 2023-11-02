import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Sidebar from './Sidebar';
import './CardFetcher.css';

function CardFetcher() {
    const [showNames, setShowNames] = useState(true); // default to show names
    const [layout] = useState([]);
    const [gridSize, setGridSize] = useState(5);  // For a 3x3 grid
    const [searchResults, setSearchResults] = useState([]);
    const [gridItems, setGridItems] = useState(Array(gridSize * gridSize).fill(null));
    const [charts, setCharts] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('charts')) || [];
        } catch (err) {
            console.error("Failed to load charts from localStorage:", err);
            return [];
        }
    });
const [selectedChart, setSelectedChart] = useState(null); // Currently selected chart

const saveCurrentChartIdToLocalStorage = (currentChartId) => {
    localStorage.setItem('lastOpenedChartId', currentChartId);
  };

const saveToLocalStorage = (updatedCharts) => {
    localStorage.setItem('charts', JSON.stringify(updatedCharts));
  };  



useEffect(() => {
    const updatedCharts = charts.map(chart => 
      chart.id === selectedChart ? { ...chart, gridItems: gridItems } : chart
    );
    saveToLocalStorage(updatedCharts);
  }, [gridItems, selectedChart, charts]);

  useEffect(() => {
    // Save to local storage whenever the selected chart changes
    if (selectedChart) {
      saveCurrentChartIdToLocalStorage(selectedChart);
    }
  }, [selectedChart]);
  
   

    
    const handleSearch = async (query) => {
        try {
            const response = await axios.get(`http://localhost:5000/search/${query}`);
            const limitedResults = response.data.slice(0, 20);  // Limit the results to the top 20
            setSearchResults(limitedResults);
        } catch (error) {
            console.error("Error searching for cards:", error);
        }
    };

    function handleDragStart(event) {
        event.dataTransfer.setData("cardId", event.target.id);
        event.dataTransfer.setData("source", event.target.getAttribute("data-source"));
    }

    function handleDragOver(event) {
        event.preventDefault();
    }

    function handleDrop(event, index) {
        event.preventDefault();
        
        const cardId = event.dataTransfer.getData("cardId");
        const source = event.dataTransfer.getData("source");
        
        const updatedGridItems = [...gridItems];
        
        let draggedCard = null;
        if (source === "searchResult") {
            draggedCard = searchResults.find(card => card.id.toString() === cardId);
            setSearchResults(prev => prev.filter(card => card.id.toString() !== cardId));
        } else if (source === "gridItem") {
            const sourceIndex = gridItems.findIndex(item => item && item.id.toString() === cardId);
            draggedCard = updatedGridItems[sourceIndex];
            updatedGridItems[sourceIndex] = null; // Clear the source position
        }
        
        updatedGridItems[index] = draggedCard;
    
        // If no charts exist or no chart is currently selected, create a new one
        if (!selectedChart || charts.length === 0) {
            createNewChart();
        } 
    
        setGridItems(updatedGridItems);  // Always update grid items here
    }
    
    
    

    function handleGridSizeChange(event) {
        const newSize = parseInt(event.target.value);
        setGridSize(newSize);
        setGridItems(Array(newSize * newSize).fill(null));
    }

    function getCurrentDateTime() {
        return new Date().toISOString();
      }
      
      function createNewChart() {
        const newChart = {
          id: getCurrentDateTime(),
          title: `Untitled (${getCurrentDateTime()})`,
          gridItems: Array(gridSize * gridSize).fill(null),
        };
      
        setCharts(prevCharts => {
          const updatedCharts = [...prevCharts, newChart];
          saveToLocalStorage(updatedCharts); // Save right after updating
          return updatedCharts;
        });
      
        setSelectedChart(newChart.id);
        setGridItems(newChart.gridItems);
      }
      
      
      function handleChartSelection(chartId) {
        const chart = charts.find(ch => ch.id === chartId);
        if (chart) {
          setSelectedChart(chart.id);
          setGridItems(chart.gridItems);
        }
      }
      
      function handleDeleteChart() {
        setCharts(prevCharts => {
          const updatedCharts = prevCharts.filter(ch => ch.id !== selectedChart);
          saveToLocalStorage(updatedCharts); // Save right after updating
          
          // Update the selected chart and grid items as necessary
          if (updatedCharts.length > 0) {
            const lastChart = updatedCharts[updatedCharts.length - 1];
            setSelectedChart(lastChart.id);
            setGridItems(lastChart.gridItems);
          } else {
            setSelectedChart(null);
            setGridItems(Array(gridSize * gridSize).fill(null));
          }
      
          return updatedCharts;
        });
      }
      
  

    const loadFromLocalStorage = useCallback(() => {
        try {
          const savedCharts = JSON.parse(localStorage.getItem('charts')) || [];
          const lastOpenedChartId = localStorage.getItem('lastOpenedChartId');
    
          console.log("Charts loaded from localStorage:", savedCharts);
          setCharts(savedCharts);
          
          // Check if the last opened chart ID is present and find the corresponding chart
          const lastOpenedChart = savedCharts.find(chart => chart.id === lastOpenedChartId);
          
          if (lastOpenedChart) {
            setSelectedChart(lastOpenedChart.id);
            setGridItems(lastOpenedChart.gridItems);
          } else if (savedCharts.length) {
            // Fallback to the last chart if no last opened chart ID is found
            setSelectedChart(savedCharts[savedCharts.length - 1].id);
            setGridItems(savedCharts[savedCharts.length - 1].gridItems);
          } else {
            setSelectedChart('');
            setGridItems(Array(gridSize * gridSize).fill(null));
          }
        } catch (err) {
          console.error("Failed to load charts from localStorage:", err);
        }
      }, [gridSize]);
      
      
      useEffect(() => {
        loadFromLocalStorage();
      }, [loadFromLocalStorage]); // Now it correctly lists the function as a dependency  
    
    
      
    

      return (
        <div>
            <button onClick={handleDeleteChart}>-</button>
            <select value={selectedChart || ''} onChange={e => handleChartSelection(e.target.value)}>
                {charts.map(chart => <option key={chart.id} value={chart.id}>{chart.title}</option>)}
            </select>
            <button onClick={createNewChart}>+</button>
    
            <div className="main-container">
                <Sidebar 
                    onSearch={handleSearch}
                    searchResults={searchResults}
                    showNames={showNames}
                    setShowNames={setShowNames}
                    gridSize={gridSize}
                    handleGridSizeChange={handleGridSizeChange}
                />
                <div className={`grid-container ${layout}`} style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}>
                    {Array.from({ length: gridSize * gridSize }).map((_, index) => {
                        const currentCard = gridItems[index];
                        return (
                            <div key={index} className="grid-item" onDrop={(e) => handleDrop(e, index)} onDragOver={handleDragOver}>
                                {currentCard && currentCard.image_uris && currentCard.image_uris.art_crop && (
                                    <img 
                                        className="cropped-image" 
                                        src={currentCard.image_uris.art_crop} 
                                        alt={currentCard.name}
                                        draggable="true" 
                                        onDragStart={handleDragStart} 
                                        id={currentCard.id.toString()}
                                        data-source="gridItem"
                                        onDrop={handleDrop}
                                        onDragOver={e => e.preventDefault()}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
                <div className="card-names-column">
                    {Array.from({ length: gridSize * gridSize }).map((_, index) => {
                        const currentCard = gridItems[index];
                        return (
                            <p className="card-name" style={{visibility: showNames ? 'visible' : 'hidden'}}>
                                {currentCard && currentCard.name}
                            </p>
                        );
                    })}
                </div>
            </div>
        </div>
    );
    
}

export default CardFetcher;