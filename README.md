# GeoTag Overlay

Skip to chat input

GeoTag Studio

4m 20s
Details












































Thought for 12s
This is a massive build, so I'm thinking pragmatically: a single-page app using ffmpeg.wasm from a CDN, with satellite map tiles sourced from Esri World Imagery since it's free and doesn't require an API key, composited client-side onto a canvas by fetching tiles based on lat/lon and zoom.

For geocoding I'll use Nominatim since it's free and supports CORS. I'm planning out the file structure — types for geotags and video, lib modules for geocoding, map tile fetching, canvas-based geotag rendering, ffmpeg wrapper, and video processing utilities, plus the UI components and main route.

For ffmpeg.wasm, I need to install the core packages and load them dynamically client-side only, since it can't run server-side. The overlay approach will composite a PNG onto the video with timed visibility and trimming, and I'll use JSZip for packaging the final output. Time to start installing dependencies and writing the code.

Installing video processing libraries
bun add @ffmpeg/ffmpeg @ffmpeg/util jszip 2>&1 | tail -5; ls src/components/ui 2>/dev/null | head -30
Thought for 8s
Good, shadcn ui is available. I'm planning out the file structure now—types for geotags and video, lib modules for geocoding, map providers, rendering, ffmpeg and video processing, plus header and location form components.

I'll keep the whole app state in the index route for simplicity, passing props down to the other components. For the map, I'm using Esri World Imagery tiles with CORS support, drawing a 3x3 tile grid centered on the coordinates with a red pin marker and attribution text. The geotag renderer builds a 1200x300 canvas with a rounded map preview on the left and a dark charcoal info panel on the right, and I'll load the FFmpeg single-thread core from unpkg for video processing.

Checking available UI components
ls src/components/ui | tail -20; cat src/start.ts; cat vite.config.ts
Thought for 8s
I'm ready to write the files now, starting with the lib files. Since I'm using ffmpeg.wasm in single-thread mode, I don't need to worry about COOP/COEP headers.

Edited
geotag.ts
src/types/geotag.ts
export type GeotagSizePreset = "small" | "medium" | "large";

export type OverlayPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface GeotagData {
  country: string;
  countryCode: string;
  state: string;
  city: string;
  address: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  /** ISO date (yyyy-mm-dd) */
  date: string;
  /** HH:MM 24h */
  time: string;
  altitude: string;
  accuracy: string;
}

export interface GeotagDisplayOptions {
  showAddress: boolean;
  showCoordinates: boolean;
  showDate: boolean;
  showTime: boolean;
  showAltitude: boolean;
  showAccuracy: boolean;
  mapType: "satellite" | "street";
  sizePreset: GeotagSizePreset;
  opacity: number;
}

export const DEFAULT_DISPLAY_OPTIONS: GeotagDisplayOptions = {
  showAddress: true,
  showCoordinates: true,
  showDate: true,
  showTime: false,
  showAltitude: false,
  showAccuracy: false,
  mapType: "satellite",
  sizePreset: "medium",
  opacity: 1,
};

export const SIZE_PRESET_WIDTH: Record<GeotagSizePreset, number> = {
  small: 900,
  medium: 1200,
  large: 1600,
};

Edited
video.ts
src/types/video.ts
Edited
geocoding.ts
src/lib/geocoding.ts
Edited
geocoding.ts
src/lib/geocoding.ts
Thought for 20s
Now I'm moving on to mapProvider.ts.

Edited
mapProvider.ts
src/lib/mapProvider.ts
Now the geotag renderer and ffmpeg/video libs.



Different percentage

Different position

Different size

Different timing

Also provide:

Apply Current Settings to All Videos

27. PROCESSING QUEUE

Do NOT process all six large videos simultaneously.

Process sequentially:

Video 1
↓
Video 2
↓
Video 3
↓
...


Show:

Processing 2 of 6

Video 2

████████████████░░░░ 78%


28. OUTPUT

After processing:

Videos Ready

For each:

site_video_01_geotagged.mp4

Original: 02:04
Final: 01:50
Geotag: 30%

✓ Ready

[Preview]
[Download]


Provide:

Download All

If practical, create a ZIP completely in the browser.

Do not upload videos to a server to create the ZIP.

29. FILE NAMES

Automatically generate:

originalname_geotagged.mp4


Example:

site_video_01.mp4


becomes:

site_video_01_geotagged.mp4


30. CLEAR DATA

Add:

Clear All

When clicked:

Remove uploaded videos.

Remove generated outputs.

Revoke object URLs.

Clear browser memory references.

Reset the workspace.

Ask for confirmation before clearing.

31. PRIVACY MESSAGE

Display:

Your videos are processed locally in your browser and are not permanently stored.

Make it clear that generated files exist only temporarily until the user downloads them or closes/refreshes the page.

32. UI DESIGN

Create a professional but simple interface.

Do NOT make it look like a social-media editor.

Use:

Clean white/neutral background

Dark charcoal sections

Cards

Rounded corners

Clear typography

Professional icons

Progress indicators

The geotag itself must closely match the uploaded reference, including its dark charcoal information panel.

33. MAIN PAGE

Header:

GeoTag Video Generator

Subtitle:

Generate professional GPS location overlays for your videos

Main workflow indicator:

1. Location
      ↓
2. Geotag
      ↓
3. Upload Videos
      ↓
4. Edit
      ↓
5. Generate
      ↓
6. Download


34. WORKSPACE LAYOUT

Desktop:

LEFT:

Location Details

Address

Coordinates

Date

Time

Altitude

Accuracy

RIGHT:

Exact Geotag Preview

Then below:

Video Upload

Then:

Video Editor

Then:

Generate

35. GEOTAG PREVIEW CONTROLS

Include:

Template: Reference Template

Map: Satellite

Show Address: ON
Show Coordinates: ON
Show Date: ON
Show Time: ON
Show Altitude: ON
Show Accuracy: ON

Position: Bottom Center

Size: 100%

Opacity: 100%


Do not add unnecessary visual effects.

36. TEMPLATE FIDELITY

The uploaded image is the design reference.

The implementation should preserve:

Wide horizontal proportions

Left map panel

Dark charcoal right panel

White text

Large first line

Smaller address line

Coordinate line

Date/time line

Bottom information row

Rounded outer corners

Red location marker

Map attribution

Do not replace this with:

A small floating location badge

A Google Maps popup

A generic bottom-third

A completely different design

The result must visually resemble the supplied reference.

37. RESPONSIVE DESIGN

Desktop should be the primary experience.

Mobile should stack:

Location
↓
Geotag Preview
↓
Upload
↓
Editor
↓
Processing
↓
Download


38. ERROR HANDLING

Handle:

Invalid address

Address not found

Missing coordinates

Invalid latitude

Invalid longitude

Unsupported video

FFmpeg loading failure

Browser memory limitations

Processing failure

Download failure

Show useful messages.

Example:

Unable to process this video in your browser.
Try using an MP4 video or a shorter/smaller video.


Never silently fail.

39. PERFORMANCE

Optimize for approximately:

1–6 videos

with videos around:

2 minutes each

Use sequential processing.

Initialize FFmpeg only when required.

Clean up:

Object URLs

Temporary blobs

FFmpeg files

unused video elements

Do not keep unnecessary copies of videos in memory.

40. PROJECT STRUCTURE

Use a clean TypeScript architecture:

src/
  components/
    Header.tsx
    LocationForm.tsx
    MapPreview.tsx
    GeotagPreview.tsx
    GeotagSettings.tsx
    VideoUploader.tsx
    VideoCard.tsx
    VideoEditor.tsx
    VideoTimeline.tsx
    ProcessingProgress.tsx
    OutputVideoCard.tsx

  lib/
    geocoding.ts
    mapProvider.ts
    geotagRenderer.ts
    videoProcessor.ts
    ffmpeg.ts
    videoUtils.ts

  types/
    geotag.ts
    video.ts

  pages/
    Index.tsx


Keep:

UI logic

separate from:

Video-processing logic

and:

Geotag rendering logic.

41. NO DATABASE

There is no need for a database.

Do not create database tables just to store:

Videos

Video metadata

Generated files

Use local React state.

If settings need to persist during a browser session, localStorage may be used for NON-VIDEO settings only.

Never put video blobs into localStorage.

42. REQUIRED ACCEPTANCE TEST

Before considering the application finished, test this exact workflow:

LOCATION

Open app.

Click Start New Project.

Enter:

SBI Complex, Beerwah, 193411, Jammu and Kashmir, India


Click Get Location.

Coordinates appear.

Map updates.

Red location pin appears.

GEOTAG

City/state/country appears.

Address appears.

Latitude appears.

Longitude appears.

Date appears.

Time appears.

Geotag visually resembles the uploaded reference.

Map is part of the geotag.

VIDEO

Upload MP4.

Video preview works.

Open editor.

Trim video.

Select 20%.

Calculated geotag duration is correct.

Select Bottom Center.

Preview geotag over video.

CHANGE PERCENTAGE

Change 20% → 30%.

Geotag duration changes automatically.

Preview updates.

PROCESS

Click Generate Geotagged Video.

Actual FFmpeg/browser processing occurs.

Progress is displayed.

Output MP4 is generated.

DOWNLOAD

Preview output.

Download output.

Open downloaded video.

Verify the exact geotag overlay is actually present.

MULTIPLE VIDEOS

Upload 5–6 videos.

Configure different percentages.

Process them sequentially.

Download each result.

Download All works.

PRIVACY

Clear All.

Temporary video references are removed.

No uploaded video exists in permanent application storage.

43. MOST IMPORTANT REQUIREMENT

The final application must successfully perform:

ADDRESS
   ↓
GEOCODE
   ↓
MAP + RED PIN
   ↓
EXACT REFERENCE GEOTAG
   ↓
UPLOAD VIDEO
   ↓
TRIM
   ↓
CHOOSE 20% / 30% / 40% / ... / 100%
   ↓
PLACE GEOTAG
   ↓
LIVE PREVIEW
   ↓
FFMPEG PROCESSING
   ↓
FINAL MP4
   ↓
DOWNLOAD


Do not stop after creating the UI.

Do not give me instructions for how I could implement it later.

Build the working application now.

44. FINAL RULE

FUNCTIONALITY > APPEARANCE

The application must actually generate a downloadable video with the geotag burned into the video.

The geotag must be based on the uploaded reference template.

The map must correspond to the entered location.

The address, coordinates, date, time, altitude and accuracy must be dynamic.

The percentage must control the actual duration of the overlay.

The video must be processed locally whenever possible.

No permanent video storage.

Build everything in ONE generation.
BUILD THIS COMPLETE APP WITH A STRICT 5-CREDIT BUDGET

Build a working GeoTag Video Generator in one generation.

I have a very limited Lovable credit budget — approximately 5 credits — so DO NOT waste credits on unnecessary features, authentication, database architecture, dashboards, complex navigation, or excessive UI.

Prioritize:

FUNCTIONAL VIDEO PROCESSING > UI DESIGN

Build only the functionality described below.

Do not ask questions.

Do not stop with a prototype.

Do not create fake buttons.

Do not leave TODOs.

Do not generate unnecessary backend infrastructure.

CORE PURPOSE

I want a website where I can:

Enter an address.

Get the location/coordinates.

Generate a geotag using the exact layout of my uploaded reference image.

Upload 1–6 videos.

Trim a video.

Choose how much of the video gets the geotag:

20%

30%

40%

50%

60%

75%

100%

Preview the geotag over the video.

Burn the geotag into the video.

Download the finished MP4.

Do everything without permanently storing the videos.

IMPORTANT: USE MY UPLOADED TEMPLATE

I uploaded a reference geotag image.

Use that image as the visual design reference.

The geotag should look like this structure:

┌───────────────────────────────────────────────────────────────┐
│                                                               │
│  MAP / SATELLITE  │  Budgam, Jammu and Kashmir, India 🇮🇳    │
│  RED LOCATION PIN │  SBI Complex, Beerwah,193411,...         │
│                   │  Lat 33.808814° Long 81.849058°          │
│                   │  Thursday, 22/01/2026                    │
│                   │                                           │
└───────────────────────────────────────────────────────────────┘


The exact values above are examples from my reference image.

They must NOT be hard-coded.

GEOTAG DESIGN

The generated geotag must have:

LEFT SIDE

Approximately 20–25% width.

Contains:

Satellite/map image

Red location pin

Map attribution where required

RIGHT SIDE

Dark charcoal/grey background.

White text.

Large first line:

{City}, {State}, {Country} 🇮🇳


Second line:

{Address}


Third line:

Lat {latitude}° Long {longitude}°


Fourth line:

{Day}, {DD/MM/YYYY}


Optional time:

{Day}, {DD/MM/YYYY} {HH:MM}


The overall shape must be a wide horizontal banner with rounded corners, matching the reference image.

Do not replace this design with a generic location badge.

LOCATION FORM

Create one simple page.

At the top:

GeoTag Video Generator

Then:

Location

Fields:

Address
Latitude
Longitude
Date
Time
Altitude
Accuracy


Only Address is required initially.

Button:

Get Location

Use a suitable geocoding API.

If geocoding is unavailable without an API key, allow manual latitude/longitude entry.

After successful geocoding:

Fill latitude.

Fill longitude.

Fill city/state/country if available.

Update the geotag preview.

MAP

The left side of the geotag must contain a map/satellite image corresponding to the selected location.

Use the simplest reliable mapping solution available.

Do not build a complicated map application.

The map only needs to:

Center on latitude/longitude.

Show a red location pin.

Produce an image that can be included in the final geotag.

The map image must become part of the actual video overlay.

Follow the selected map provider's attribution requirements.

GEOTAG PREVIEW

Immediately below the location form:

Geotag Preview

Render the complete geotag.

The preview should update when I change:

Address

Latitude

Longitude

Date

Time

Altitude

Accuracy

Allow simple toggles:

Show Address
Show Coordinates
Show Date
Show Time
Show Altitude
Show Accuracy


Default all important fields to ON.

VIDEO UPLOAD

Below the geotag:

Upload Videos

Allow up to 6 videos.

Use browser file input.

Supported:

MP4

MOV where browser/FFmpeg supports it

WebM

Do NOT upload videos to permanent storage.

Do NOT create:

Supabase Storage

Firebase Storage

Google Drive

AWS S3

Keep videos in browser memory/object URLs.

Show each uploaded video as a simple card:

video.mp4
02:03
1920 × 1080

[Edit] [Remove]


VIDEO EDITOR

Clicking Edit should show:

Video preview

Start time

End time

Trim button

Example:

Original: 02:00

Start: 00:10
End:   01:40

Final: 01:30


Allow the user to change start/end.

The final geotag percentage must be calculated from the trimmed duration.

GEOTAG PERCENTAGE

This is a critical feature.

Show:

Geotag Duration

Buttons:

20%
30%
40%
50%
60%
75%
100%


Also provide a slider if it is easy to implement.

Example:

Trimmed video:

100 seconds


Selected:

20%


Geotag duration:

20 seconds


Selected:

30%


Geotag duration:

30 seconds


Selected:

100%


Geotag duration:

100 seconds


Display:

Geotag will appear for 30 seconds of this video.

GEOTAG TIMING

For simplicity, implement:

Beginning

Default.

If the final video is 100 seconds and geotag percentage is 30%:

Geotag:
0 → 30 seconds


Also provide:

End

Example:

70 → 100 seconds


If easy, add:

Custom Start

But do NOT sacrifice core video processing for this feature.

GEOTAG POSITION

Provide simple buttons:

Top Left
Top Right
Bottom Left
Bottom Right
Bottom Center


Default:

Bottom Center

The entire wide geotag template should move as one object.

LIVE VIDEO PREVIEW

Show the uploaded video.

Place the generated geotag over it.

The preview should respect:

Position

Percentage

Timing

Trim

Use HTML5 video + overlay for preview.

It does NOT need to be pixel-perfect in the browser preview as long as the final generated video is correct.

ACTUAL VIDEO PROCESSING

This is the MOST IMPORTANT FUNCTION.

Use:

FFmpeg WebAssembly / ffmpeg.wasm

or another browser-compatible FFmpeg implementation.

Do NOT fake video processing.

When I click:

Generate Geotagged Video

actually create a new video containing the geotag.

Processing pipeline:

Original Video
      ↓
Trim
      ↓
Calculate Final Duration
      ↓
Generate Geotag Image
      ↓
Overlay Geotag
      ↓
Apply Geotag Timing
      ↓
Encode MP4
      ↓
Download


IMPORTANT GEOTAG CALCULATION

Percentage must be based on the trimmed output duration.

Example:

Original:

120 seconds


Trim:

20 → 100


Final:

80 seconds


Selected:

30%


Geotag duration:

24 seconds


Therefore geotag should appear from:

0 → 24 seconds


when "Beginning" is selected.

GEOTAG AS A SINGLE IMAGE

Do NOT attempt to overlay separate HTML elements directly into FFmpeg.

Instead:

Generate the complete geotag as Canvas/SVG/image.

Convert it to PNG.

Give that PNG to FFmpeg.

Overlay that PNG onto the video.

The PNG must contain:

MAP
+
RED PIN
+
DARK CHARCOAL PANEL
+
LOCATION
+
ADDRESS
+
COORDINATES
+
DATE
+
TIME
+
OPTIONAL ALTITUDE/ACCURACY


This is important because the final MP4 needs the complete geotag burned into it.

OUTPUT

After processing:

✓ Video Ready

video_geotagged.mp4

[Preview]
[Download]


The Download button must download the actual generated MP4.

Filename:

originalfilename_geotagged.mp4


MULTIPLE VIDEOS

Support up to 6 videos.

Process them one at a time to reduce browser memory usage.

Example:

Processing 1 of 5
████████████░░░░ 72%


Then:

Processing 2 of 5


Each video may have its own:

Trim

Percentage

Position

Provide:

Apply Settings to All

only if easy.

Do not make this feature complicated.

DOWNLOAD ALL

After processing multiple videos:

Show:

Video 1   [Download]
Video 2   [Download]
Video 3   [Download]


If easy, provide:

Download All

using browser-side ZIP generation.

If ZIP generation risks exceeding the implementation scope, omit it.

Individual downloads are REQUIRED.

NO PERMANENT STORAGE

Do not create a database.

Do not create authentication.

Do not create accounts.

Do not store videos.

Do not store generated videos.

Use browser:

File

Blob

Object URL

Release object URLs when videos are removed.

Add:

Clear All

button.

SIMPLE UI

Use only ONE main workspace page.

Do not create:

Login

Signup

Dashboard

Profile

Admin panel

Database management

User management

Billing

Analytics

These are unnecessary.

UI LAYOUT

Use:

┌───────────────────────────────────────────────┐
│ GeoTag Video Generator                        │
├───────────────────────────────────────────────┤
│                                               │
│ LOCATION                                      │
│ Address [____________________] [Get Location] │
│                                               │
│ Latitude [________] Longitude [________]      │
│ Date [________] Time [________]               │
│                                               │
│ ┌───────────────────────────────────────────┐ │
│ │          GEOTAG PREVIEW                   │ │
│ │ MAP │ Location / Address / Coordinates    │ │
│ └───────────────────────────────────────────┘ │
│                                               │
│ VIDEO                                         │
│ [ Upload Videos ]                             │
│                                               │
│ video1.mp4   [Edit] [Remove]                 │
│ video2.mp4   [Edit] [Remove]                 │
│                                               │
│ GEOTAG DURATION                               │
│ [20%] [30%] [40%] [50%] [75%] [100%]        │
│                                               │
│ POSITION                                      │
│ [Bottom Center ▼]                             │
│                                               │
│ [ Generate Geotagged Video ]                 │
│                                               │
│ PROCESSING                                    │
│ ███████████████░░░ 75%                        │
│                                               │
│ ✓ video1_geotagged.mp4 [Download]            │
└───────────────────────────────────────────────┘


Keep the UI simple.

TECHNICAL STACK

Use:

React

TypeScript

Vite

Tailwind CSS

shadcn/ui only where useful

FFmpeg WebAssembly

Canvas/SVG for geotag generation

Browser File API

Avoid unnecessary dependencies.

COMPONENTS

Keep the application small.

Suggested components:

App.tsx

LocationForm.tsx
GeotagPreview.tsx
VideoUploader.tsx
VideoEditor.tsx
VideoSettings.tsx
ProcessingProgress.tsx
OutputVideo.tsx


Libraries:

geotagRenderer.ts
videoProcessor.ts
geocoding.ts


Do not create dozens of files unnecessarily.

PERFORMANCE

Because videos can be around 2 minutes:

Process sequentially.

Do not process six videos simultaneously.

Initialize FFmpeg only when needed.

Clean up temporary files.

Clean up Blob URLs.

Avoid unnecessary copies.

If the browser cannot process a particular video:

Show:

This video is too large or unsupported by your browser. Try an MP4 video or a shorter video.

Do not crash.

IMPORTANT: CREDIT OPTIMIZATION

I have only approximately 5 Lovable credits.

Therefore:

DO NOT:

Rebuild the application repeatedly.

Add unnecessary pages.

Add authentication.

Add database.

Add backend video storage.

Add advanced animations.

Add unnecessary dependencies.

Create elaborate design systems.

Create unnecessary settings pages.

Build the complete core application in this generation.

If a feature conflicts with the 5-credit limitation, prioritize in this exact order:

Upload video

Generate exact geotag

Trim

Percentage-based geotag duration

Actual FFmpeg processing

Download MP4

Multiple videos

Address geocoding

Map

UI polish

ACCEPTANCE TEST

The application is only considered complete if I can do this:

STEP 1

Enter:

SBI Complex, Beerwah, 193411, Jammu and Kashmir, India


STEP 2

Click:

Get Location

STEP 3

The application generates:

Budgam, Jammu and Kashmir, India 🇮🇳

SBI Complex, Beerwah,193411, Jammu and Kashmir

Lat XX.XXXXXX° Long XX.XXXXXX°

Thursday, 22/01/2026


with the map/satellite section and red pin.

STEP 4

Upload a 2-minute MP4.

STEP 5

Trim it.

STEP 6

Select:

20%

The application calculates the correct geotag duration.

STEP 7

Preview.

STEP 8

Select:

30%

The geotag duration changes automatically.

STEP 9

Click:

Generate Geotagged Video

STEP 10

The actual MP4 is generated.

STEP 11

Click:

Download

STEP 12

Open the downloaded MP4.

The geotag must actually be burned into the video.

FINAL INSTRUCTION

Build this as a small, functional, production-usable utility, not a large SaaS application.

The single most important result is:

I upload a video → choose 20%/30%/etc. → the exact reference-style geotag appears on the video for that percentage of its duration → I download the finished MP4.

Use the uploaded geotag image as the visual reference.

Do everything possible within the approximately 5-credit Lovable budget.

Build it now in one generation.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://geo-tag-creator.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/63a883c9-0980-42ef-adc6-b91f7e8e1082).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
