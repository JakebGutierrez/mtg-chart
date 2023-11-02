import React, { useState } from 'react';
import axios from 'axios';
import Sidebar from './Sidebar';
import './CardFetcher.css';

function CardFetcher() {
    const [showNames, setShowNames] = useState(true); // default to show names

    const [layout] = useState([]);


    const [gridSize, setGridSize] = useState(5);  // For a 3x3 grid
    
    const [searchResults, setSearchResults] = useState([]);
    const [gridItems, setGridItems] = useState(Array(gridSize * gridSize).fill(null));

    


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
            updatedGridItems[sourceIndex] = updatedGridItems[index];
        }
    
        updatedGridItems[index] = draggedCard;
        setGridItems(updatedGridItems);
    }

    function saveCollage(gridItems) {
        // Convert the state to a string and save it in local storage
        localStorage.setItem('savedCollage', JSON.stringify(gridItems));
    }
    
    function loadCollage() {
        // Fetch the saved state from local storage and convert it back to an object
        const savedCollage = JSON.parse(localStorage.getItem('savedCollage'));
        return savedCollage || []; // Return an empty array if no collage is saved
    }
    
    function handleSave() {
        saveCollage(gridItems);
        alert("Collage saved!");
    }

    function handleLoad() {
        const loadedCollage = loadCollage();
        setGridItems(loadedCollage);
    }

    function handleGridSizeChange(event) {
        const newSize = parseInt(event.target.value);
        setGridSize(newSize);
        setGridItems(Array(newSize * newSize).fill(null));
    }

    function resetGrid() {
        setGridItems(Array(gridSize * gridSize).fill(null));
    }
    

    return (
        <div>
            <button onClick={handleSave}>Save Chart</button>
            <button onClick={handleLoad}>Load Chart</button>
            <button onClick={resetGrid}>Reset</button>



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
                <div className="grid-item" onDrop={(e) => handleDrop(e, index)} onDragOver={handleDragOver}>
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