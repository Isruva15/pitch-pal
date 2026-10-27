# Pitch Pal

A handheld-game-style soccer player who lives on your desktop. How you do on your daily tasks decides how they feel, how full their stadium is, and how fast their club climbs the divisions.

## On your desktop
- **The player** lives in the bottom-left corner of your second monitor (or your main one if you only have one), at a small size, with a badge showing how many tasks are left. Drag them anywhere; click the badge to open the app.
- **Tray menu** (by the clock): open the app, show today's reminder, choose which monitor the player lives on, keep them on top, put them back in the corner, start with your computer, quit.
- Closing the main window keeps Pitch Pal running.

## Reminders
A *get-active nudge* (12:30, only while a Fitness task is open) and an *evening check-in* (6pm) pop up in the bottom-left corner of your main screen if tasks are still open. Tick tasks off right there, open the app, snooze for an hour, or choose *Not today*. Change or clear either time in the Reminders panel.

## Google Calendar
1. Open Google Calendar on the web and go to Settings.
2. Under *Settings for my calendars*, pick your calendar.
3. In *Integrate calendar*, copy the *Secret address in iCal format*.
4. Paste it into the Google Calendar panel in Pitch Pal and press Connect.

Today's events appear in the panel. Workouts and practices (gym, run, training, soccer, yoga...) become tasks for that day, or choose *Every event* or *None*. Reminders wait until an event finishes. Pitch Pal syncs every 15 minutes; the address stays on your computer and is read-only. Google can take a while to publish changes to this address.

## This week
With Google Calendar connected, a week view shows every event, with today highlighted and workouts marked in green. Use the arrows to look at other weeks.

## Daily reading
A passage of classic literature, poetry and philosophy every day (public-domain works and translations). Use the arrows to browse.

## Daily news
At the bottom of the app: top headlines and a scrollable list of stories from AP News, NPR, the Guardian's Premier League section and BBC Sport Football. Filter by source; click a story to open it in your browser. Refreshes every 30 minutes. AP no longer publishes its own RSS feed, so AP stories come from AP's Top Stories feed on Flipboard, or from Google News when that's unavailable.

## Starts with your computer
Pitch Pal starts quietly when you sign in to Windows (just the desktop player). Turn it off under Reminders or in the tray menu.

## Training days and rest days
Each task can be due every day or only on chosen days (click the "Daily" chip next to a task). Tasks that aren't due today don't count. Once a week you can take a rest day: no penalties, and your streak is paused.

## Season and Match Day
Your club plays in an 8-club league. One match is played at the end of every week, and the result depends on how much of that week's training you finished. The match plays out on the stadium screen with live commentary. After 7 matches the season ends: the top 2 are promoted, the bottom 2 relegated. Divisions run from Sunday League to Legend.

## Progress
A 30-day chart of Energy, Fitness and Morale (hover for exact values, or open the table view) and a 16-week calendar of every day you trained.

## Badges and unlocks
16 badges. Some unlock extras: Golden boots (7-day streak), Captain's armband (50 tasks), Floodlights (first win), Big screen (5 wins), Crown and trophy (win a league), Gold version palette (finish a season).

## Sounds
Chiptune sound effects for ticks, a finished day, badges, goals and results. Switch them off in Customize.

## Quick tick from the desktop
Right-click the little player on your desktop to tick off today's tasks without opening the app.

## Backups
Pitch Pal saves a backup every day and keeps two weeks of them (Backup & updates > Open backups folder). Export a backup to keep a copy anywhere; Import restores one.

## Updates and code signing
- Automatic updates are built in but switched off until new versions are published somewhere the app can download them from, such as GitHub Releases. Add a `publish` section to `build` in package.json (for example `{ "provider": "github", "owner": "you", "repo": "pitch-pal" }`) and publish with `npm run dist -- --publish always` and a `GH_TOKEN`.
- To remove the "Windows protected your PC" warning, buy a code-signing certificate and set `CSC_LINK` (the .pfx file) and `CSC_KEY_PASSWORD` before `npm run dist`. electron-builder signs the installer automatically.

## How it plays
- Each task trains **Energy**, **Fitness** or **Morale**. Ticking one off adds 12 to its stat and 1 XP.
- At midnight every unfinished task costs its stat 18, and all stats drop by 4. Days with the computer off count as missed.
- Finish everything for a **streak**; finishing the last task makes the player celebrate.
- Moods: *On fire* (juggling, music notes), *OK*, *Tired* (sweat drop, slow), *Hurt* (lying on the pitch with a first-aid kit). The pitch dries out when the player is neglected.
- League results promote or relegate the club; each division adds a flag on the stand roof and a star on the board.

## Customize
Name, number, club name, hairstyle (spiky, short, long, curly, buzz, ponytail), hair colour, skin tone, headwear (cap, headband) and its colour, shirt colour, pattern (stripes, hoops, halves, sash) and pattern colour, shorts, boots, and the screen palette: Color, Red version, Blue version, Classic green or Pocket grey.

All art is original pixel art in a classic handheld style.

## Build
```
npm install
npm start          # run it
npm run dist       # build an installer into dist/
```
