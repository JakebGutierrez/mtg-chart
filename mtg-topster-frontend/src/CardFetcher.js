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
    const [charts, setCharts] = useState([]); // Will contain a list of all saved charts
const [selectedChart, setSelectedChart] = useState(null); // Currently selected chart

const saveToLocalStorage = useCallback(() => {
    const updatedCharts = charts.map(ch => {
      if (ch.id === selectedChart) {
        ch.gridItems = gridItems;
      }
      return ch;
    });
    setCharts(updatedCharts);
    localStorage.setItem('charts', JSON.stringify(updatedCharts));
    // console.log("Charts saved to localStorage:", updatedCharts);

}, [charts, selectedChart, gridItems]);

useEffect(() => {
    loadFromLocalStorage();
}, []);

useEffect(() => {
    saveToLocalStorage();
}, [charts, selectedChart, gridItems, saveToLocalStorage]);

    
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
        setCharts(prevCharts => [...prevCharts, newChart]);
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
        // Remove the selected chart from the charts list
        const updatedCharts = charts.filter(ch => ch.id !== selectedChart);
        setCharts(updatedCharts);
    
        // Set the selected chart to the last one in the updated list
        if (updatedCharts.length > 0) {
            setSelectedChart(updatedCharts[updatedCharts.length - 1].id);
            setGridItems(updatedCharts[updatedCharts.length - 1].gridItems);
        } else {
            // No charts left
            setSelectedChart(null);
            setGridItems(Array(gridSize * gridSize).fill(null));
        }
    }
    

    function loadFromLocalStorage() {
        const savedCharts = JSON.parse(localStorage.getItem('charts')) || [];
        console.log("Charts loaded from localStorage:", savedCharts);
        setCharts(savedCharts);
        if (savedCharts.length) {
            setSelectedChart(savedCharts[savedCharts.length - 1].id); // select the last chart
        } else {
            setSelectedChart(''); // No saved charts
        }
    }
    
    
      
    

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