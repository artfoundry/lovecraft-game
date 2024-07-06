# Lovecraft themed RPG

Working title: War of the Old Ones

Current demo: https://lovecraft-oldones.web.app/
(note: not yet mobile friendly and Google login is not currently functional)

*WIP*

*CURRENT WORKING BRANCH: adding-characters*

---
#### Current status:

11/28/23: More mobile optimizations; added help screens; control bars now show health, sanity, spirit and have more space for buttons; character info panels now have tabs for inv/attributes/skills; bug fixes.

10/31/23: Fixed styling and functionality for mobile, so now everything should work on phone and tablet. Changing lighting to be smoothly blended between tiles! Moving game settings (music and audio for now) into settings panel. Adding zoom slider to zoom in/out on map.

8/29/23: Added objects to pick up (ammo, weapons, lights, health kits, etc.). Changed PC info panel to full inventory with paper doll. Added drag and drop to move items in inventory, trade between characters, and drop items.

5/7/23: Added line of sight pathing for accurate ranged attacks and tracking party members. Improvements to UI for mobile. Map piece randomization weighting during layout.

4/15/23: Finished initiative system.  Added mode switching for follow/tactical modes (with three PCs now playable as a party).  Added movement animation.

3/24/23: adding firebase login/authentication

3/18/23: initiative-system branch merged into main. Ground work for multiple PCs. Made lighting system dynamic. Refactored coordinate storage.

3/8/23: (forgot to update status since Aug) PC and Creature classes. Combat. Initiative system (almost done).

8/30/22: Tool for creating map pieces.  See below for instructions.

8/11/22: Randomized dungeon with lighting. One tileset (catacombs).

---
This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\

---
## Map Piece Creation Tool

- Copy the mapData.json file from /client/src to /mapLayoutTool.
- From /mapLayoutTool, run `node fileAccessServer.js` to start the Express file access server.
- Then run `npm start` to start the tool itself.  A browser window will open to http://localhost:3001/.

When the tool loads, all map data pieces will be displayed in the left column. Click on any of them to load it onto the grid.
Select tiles in the grid to edit or move them.  Select tiles in the top Tile Templates section and then click in the grid to place new tiles.
Click Clear grid on the right to clear the grid of all tile data (this does not affect the mapData.json file).

### Saving
If modifying an existing piece, simply click Save piece on the right side.
If creating a new piece, enter a piece name and then click Save. Newly saved pieces will appear at the bottom of the column on the left

NOTE: On clicking Save piece, all map data will be written to the mapData.json file,
so make sure you want to save before doing so!

Once you've finished making all your edits and saved, copy the mapData.json file back to /client/src,
renaming it if necessary to be used for different game areas.

### Deleting
To delete a piece from the collection, simply select the piece on the left, then click Delete piece on the right.

NOTE: On clicking Delete piece, all map data will be written to the mapData.json file,
so make sure you want to delete before doing so!  Once it's gone, you can't get it back!

To delete a tile, select the tile on the grid, then click Delete tile at the bottom right of the page.
Deleting a tile does NOT save to the json file - it simply removes it from the grid.

### Editing tile information

Before saving a piece, you need to set up neighbor and alt class information.
These are used for when a piece's opening tile is changed or deleted to close the opening
(for when the opening is left without another piece next to it during map layout in the game).
Neighbor data indicates which tiles need to be deleted or have their type, class, or side type changed.
Alt class data indicates what a tile's class/texture should be changed to when a neighboring opening tile is closed or deleted.

#### Neighbor settings

- Select a tile on the grid
- Click 'Select tiles' on the right.
- Choose a selection mode among the four.
- Then simply select the tile(s) on the grid. Selecting them will highlight them to indicate the selection.
- You can then change selection mode and select tiles for that setting.
- Rinse and repeat. Selecting each mode will show which tiles have been selected for that option.
- Click the Select tiles button again to exit Neighbor settings.  Your settings will be stored in the tiles
  on the grid.

Make sure to save the piece to keep your changes!

#### Alt class settings

- Select a tile on the grid
- Click 'Select alts' on the right.
- Proceed through the three selection modes in order. Not all tiles will need all three settings.
- Select the tile on the grid that has the opening next to the tile you selected in step 1. It will be highlighted in teal.
- Then select the tile template at the top as the alternate class. It will get highlighted in teal and the tile in the grid will get temporarily updated to show the alt class.
- If a second opening alt is needed, change to that selection mode and repeat the last two steps.
- If an alt is needed for when both openings are deleted/closed, change to that mode. Then you only need to select the alt template (you don't need to select another opening tile on the grid).
- Click the Select alts button again to exit alt class settings. Your settings will be stored in the tiles
  on the grid.

Make sure to save the piece to keep your changes!
