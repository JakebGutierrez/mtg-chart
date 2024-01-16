# MTG Chart

## Description

MTG Chart is a web application for Magic: The Gathering enthusiasts. It allows users to create and share charts and collages of their favourite MTG cards and decks. This interactive tool is perfect for showcasing powerful decks or your personal favourite cards.

## Features

- Create and customise card collages.
- Search and add cards from the MTG database.
- Interactive UI for chart modifications.
- Save and share creations.

## How to Use

MTG Chart offers an intuitive and interactive way to create visual collages of Magic: The Gathering cards. Here's how to use it:

1. **Adding Cards**

   - Click on 'Add Cards' to reveal the search bar.
   - Search for Magic: The Gathering cards using names or keywords.
   - Drag and drop your chosen cards into the grid.

2. **Managing Charts**

   - Create a new chart by clicking the '+' button at the top.
   - Each chart is automatically saved and stored in your browser.
   - Use the '-' button to delete any unwanted charts.

3. **Customisation**

   - Adjust the size of your chart grid through the 'Chart Size' dropdown under 'Chart Options'.

4. **Downloading Your Chart**
   - Click 'Download Chart' to save your creation as a PNG image.

Explore, customise, and enjoy creating your unique MTG collages!

## Installation

To set up MTG Chart locally:

1. **Clone the Repository**

```
git clone https://github.com/JakebGutierrez/mtg-chart.git
cd mtg-chart
```

2. **Install Dependencies**

- For the frontend:
  ```
  cd frontend
  npm install
  ```
- For the backend:
  ```
  cd ../backend
  npm install
  ```

3. **Running the Application**

- Start the frontend:
  ```
  cd frontend
  npm start
  ```
- Start the backend server in a separate terminal:
  ```
  cd backend
  node server.js
  ```
  Access the application at `http://localhost:3000` with the backend on `http://localhost:5000`.

## Technologies Used

- React.js
- Node.js
- Axios
- Scryfall API

## Future Improvements

- **Live Backend Server Implementation:** Aiming to deploy a live server to handle API requests, improving the reliability and scalability of the application.

- **Improved Styling and Layout:** Enhancements in the UI/UX design to offer a more intuitive and visually appealing interface.

- **Enhanced Chart Customisation Options:** Introducing more customisation features allowing users to personalise their card collages in diverse and creative ways.

- **Import Decklist Feature:** Implementing functionality to import decklists for streamlined chart creation, catering to users who wish to visualise entire decks efficiently.

- **Responsive Web Design and Mobile Optimisation:** Adapting the interface for optimal viewing and interaction across a wide range of devices, including mobile phones and tablets.

- **Advanced Sorting Features:** Implementing features like a shuffle button to randomise card arrangements, and options for sorting cards by colour, type, or alphabetically, similar to organising a physical MTG deck.

## License

This project is open source and available under the [MIT License](LICENSE).

## Contributing

Contributions to MTG Chart are welcome and appreciated. If you're interested in contributing, please follow these steps:

1. **Fork the Repository:** Create your own fork of the repo.
2. **Create a Branch:** For each new feature or bug fix, create a new branch based on the `main` branch.
3. **Make Changes:** Implement your changes or improvements in your branch.
4. **Test Your Changes:** Ensure your changes do not break any existing functionalities.
5. **Submit a Pull Request:** Open a pull request from your branch to the `main` branch of the original repo. Include a clear description of your changes.

Please note that by contributing, you agree that your contributions will be licensed under its MIT License.

## Author

[Jakeb Gutierrez](https://github.com/JakebGutierrez)
