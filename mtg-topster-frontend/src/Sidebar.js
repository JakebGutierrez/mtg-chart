import React from 'react';
import SearchBar from './SearchBar';

function Sidebar({ onSearch, searchResults, showNames, setShowNames, gridSize, handleGridSizeChange }) {
    return (
        <div className="sidebar">
            {/* Logo */}
            <div className="logo">
                {/* Add your logo image or component here */}
                <h1>MTG Chart</h1>
            </div>

            {/* Add Cards Dropdown */}
            <details className="dropdown-menu">
                <summary>Add Cards</summary>
                <SearchBar onSearch={onSearch} />

                {/* Display search results */}
                <div className="results-container">
                    {searchResults.map(card => (
                        card.image_uris && card.image_uris.art_crop ? (
                            <div className="art-container" key={card.id}>
                                <img 
                                    className="cropped-image"
                                    src={card.image_uris.art_crop}
                                    alt={card.name}
                                    draggable="true"
                                    onDragStart={e => {
                                        e.dataTransfer.setData("cardId", card.id);
                                        e.dataTransfer.setData("source", "searchResult");
                                    }}
                                    /* ... other img properties */
                                />
                            </div>
                        ) : (
                            <div className="art-container" key={card.id}>
                                <p>No image available for {card.name}.</p>
                            </div>
                        )
                    ))}
                </div>
            </details>

            {/* Chart Options Dropdown */}
            <details className="dropdown-menu">
                <summary>Chart Options</summary>
                <div className="option">
                    <label>
                        Show Card Names:
                        <input 
                            type="checkbox"
                            checked={showNames}
                            onChange={() => setShowNames(!showNames)}
                        />
                    </label>
                </div>
                <div className="option">
                    <label>
                        Chart Size:
                        <select value={gridSize} onChange={e => handleGridSizeChange(e)}>
                            <option value={2}>2x2</option>
                            <option value={3}>3x3</option>
                            <option value={4}>4x4</option>
                            <option value={5}>5x5</option>
                        </select>
                    </label>
                </div>
                {/* More options here */}
                <button>Shuffle</button>
            </details>

            {/* More dropdowns */}
            {/* Sample dropdown for "Import" */}
            <details className="dropdown-menu">
                <summary>Import</summary>
                {/* Import logic here */}
                <h3>Import from decklist coming soon</h3>
            </details>
            {/* Add more dropdowns or other sidebar content as needed */}
        </div>
    );
}

export default Sidebar;
