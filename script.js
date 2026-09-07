// --- CONFETTI ---
// A small, dependency-free confetti burst. Call launchConfetti() right after
// a real action completes (signup sent, feedback sent, donation handed off,
// daily game won) — never on page load or as decoration. Respects
// prefers-reduced-motion by skipping the animation entirely.

function launchConfetti() {
  const prefersReducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  const colors = ['#C1440E', '#10243E', '#3B6EA5', '#2ed573', '#F2A65A', '#ff4757'];
  const pieceCount = 90;

  const container = document.createElement('div');
  container.className = 'confetti-container';
  container.setAttribute('aria-hidden', 'true');
  document.body.appendChild(container);

  let maxDuration = 0;

  for (let i = 0; i < pieceCount; i++) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';

    const left = Math.random() * 100; // vw
    const duration = 2.2 + Math.random() * 1.6; // seconds
    const delay = Math.random() * 0.4; // seconds
    const drift = (Math.random() * 160 - 80); // px of horizontal drift
    const rotateStart = Math.random() * 360;
    const size = 6 + Math.random() * 6; // px
    const color = colors[Math.floor(Math.random() * colors.length)];
    const isCircle = Math.random() > 0.6;

    piece.style.left = `${left}vw`;
    piece.style.width = `${size}px`;
    piece.style.height = `${size * (isCircle ? 1 : 1.6)}px`;
    piece.style.backgroundColor = color;
    piece.style.borderRadius = isCircle ? '50%' : '2px';
    piece.style.animationDuration = `${duration}s`;
    piece.style.animationDelay = `${delay}s`;
    piece.style.setProperty('--drift', `${drift}px`);
    piece.style.transform = `rotate(${rotateStart}deg)`;

    container.appendChild(piece);
    maxDuration = Math.max(maxDuration, duration + delay);
  }

  setTimeout(() => {
    container.remove();
  }, (maxDuration + 0.3) * 1000);
}

// --- 1. SET DYNAMIC DAY OF THE WEEK ---
const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const today = new Date();

// --- SF-TIME DAY BOUNDARIES ---
// Every "what day is it" calculation on this site (the daily game, the daily
// wheel, daily trivia, which weekday tab is active by default) is anchored to
// San Francisco's actual calendar date (America/Los_Angeles), not the
// visitor's own timezone and not UTC. Without this, someone in New York sees
// "tomorrow" hours before SF does, and daily resets land at a random UTC
// offset instead of SF's real midnight.
function sfDateStamp(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date); // "YYYY-MM-DD"
}

function sfYesterdayStamp() {
  const [y, m, d] = sfDateStamp().split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

function sfDayOfYear(stamp = sfDateStamp()) {
  const [y, m, d] = stamp.split('-').map(Number);
  const current = Date.UTC(y, m - 1, d);
  const yearStart = Date.UTC(y, 0, 0);
  return Math.floor((current - yearStart) / 86400000);
}

function sfDayParts(stamp = sfDateStamp()) {
  const [y, m, d] = stamp.split('-').map(Number);
  return { year: y, month: m, day: d, weekday: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}

const sfTodayParts = sfDayParts();
const dateString = `${days[sfTodayParts.weekday]}, ${months[sfTodayParts.month - 1]} ${sfTodayParts.day}, ${sfTodayParts.year}`;

function getSFGreeting() {
  const sfHour = parseInt(
    today.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: false }),
    10
  );
  if (sfHour < 5) return 'Still up?';
  if (sfHour < 12) return 'Good morning!';
  if (sfHour < 17) return 'Good afternoon!';
  if (sfHour < 21) return 'Good evening!';
  return 'Night owl?';
}

document.getElementById('day-title').textContent = `${getSFGreeting()} It's ${dateString}. Here's what's worth doing in San Francisco.`;


// --- 2. SHARED CARD BUILDER (used by planner, dashboard, neighborhoods, weekly events, local favorite) ---
function mapsLink(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function tagBadgeHtml(tag) {
  if (tag === 'local') return '<span class="tag-badge tag-local">🏠 Local Pick</span>';
  if (tag === 'touristy') return '<span class="tag-badge tag-touristy">📸 Tourist Favorite</span>';
  return '';
}

function slugify(title) {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function getVisitedMap() {
  try {
    return JSON.parse(localStorage.getItem('sftoday-visited') || '{}');
  } catch (error) {
    return {};
  }
}

function isVisited(slug) {
  return !!getVisitedMap()[slug];
}

// "Citywide" entries (parking tips, transit reminders) aren't a real single
// place — exclude them from the visited-toggle and the checklist's total.
function isRealVisitablePlace(item) {
  return !!item.address && item.address !== 'Citywide';
}

function visitedToggleHtml(title) {
  const slug = slugify(title);
  const visitedClass = isVisited(slug) ? ' visited' : '';
  const label = isVisited(slug) ? '✓ Been there' : 'Mark as visited';
  return `<button type="button" class="visited-toggle${visitedClass}" data-slug="${slug}" data-title="${title.replace(/"/g, '&quot;')}">${label}</button>`;
}

function buildVenueCard(item) {
  const badge = tagBadgeHtml(item.tag);

  // Entries with no address (e.g. facts) render a simpler card
  if (!item.address) {
    return `
      <div class="plan-item">
        <h3>${item.title}</h3>
        <p>${item.desc}</p>
      </div>
    `;
  }

  return `
    <div class="plan-item">
      <h3>${item.title}${badge}</h3>
      <p>${item.desc}</p>
      <div class="venue-meta">
        <span class="venue-address">📍 ${item.address}</span>
        <span class="venue-hours">🕒 ${item.hours}</span>
        <a class="venue-directions" href="${mapsLink(item.address)}" target="_blank" rel="noopener">Get Directions →</a>
      </div>
      ${isRealVisitablePlace(item) ? visitedToggleHtml(item.title) : ''}
    </div>
  `;
}


// --- 3. PERMANENT / EVERGREEN CONTENT DATABASE ---
const evergreenCategories = {
  dinner: [
    { title: "El Farolito", desc: "World-famous, consistently great Mission-style burritos.", address: "2779 Mission St, San Francisco, CA", hours: "Open late — check current hours", tag: "local" },
    { title: "La Taqueria", desc: "A Mission classic, often ranked one of the best burritos in the city.", address: "2889 Mission St, San Francisco, CA", hours: "Check current hours", tag: "local" },
    { title: "Good Mong Kok Bakery", desc: "Cheap, incredibly delicious pork buns to-go in Chinatown.", address: "1039 Stockton St, San Francisco, CA", hours: "Morning to early afternoon — check current hours", tag: "local" }
  ],
  family: [
    { title: "Exploratorium", desc: "Hands-on science museum on Pier 15 that kids and adults both love.", address: "Pier 15, San Francisco, CA", hours: "Check current hours", tag: "touristy" },
    { title: "California Academy of Sciences", desc: "Aquarium, planetarium, and a 4-story rainforest inside Golden Gate Park.", address: "55 Music Concourse Dr, San Francisco, CA", hours: "Check current hours", tag: "touristy" },
    { title: "Golden Gate Park Carousel", desc: "Historic 1914 carousel with hand-carved animals next to the playground.", address: "320 Bowling Green Dr, San Francisco, CA", hours: "Check current hours", tag: "local" }
  ],
  free: [
    { title: "Palace of Fine Arts", desc: "Stunning Greco-Roman rotunda and peaceful lagoon.", address: "3601 Lyon St, San Francisco, CA", hours: "Open 24/7 (grounds)", tag: "touristy" },
    { title: "Golden Gate Bridge Walk", desc: "Walk or bike across the iconic orange span, completely free.", address: "Golden Gate Bridge Welcome Center, San Francisco, CA", hours: "Open 24/7 (pedestrian access varies by season)", tag: "touristy" },
    { title: "Cable Car Museum", desc: "See the powerhouse and museum where the historic cable cars operate.", address: "1201 Mason St, San Francisco, CA", hours: "Check current hours", tag: "local" }
  ],
  visit: [
    { title: "Alcatraz Island", desc: "The legendary former federal prison — book ferry tickets in advance.", address: "Pier 33, San Francisco, CA", hours: "Ferry departure times vary — check current schedule", tag: "touristy" },
    { title: "Twin Peaks", desc: "Sweeping 360° views from the geographic center of SF.", address: "Twin Peaks Blvd, San Francisco, CA", hours: "Open 24/7", tag: "touristy" },
    { title: "Lombard Street", desc: "The famous 'crookedest street in the world,' lined with hydrangeas.", address: "Lombard St & Hyde St, San Francisco, CA", hours: "Open 24/7", tag: "touristy" }
  ],
  outdoors: [
    { title: "Lands End Trail", desc: "Coastal hike with cypress trees, ocean views, and a hidden stone labyrinth.", address: "Lands End Trailhead, El Camino Del Mar, San Francisco, CA", hours: "Open 24/7", tag: "local" },
    { title: "Dolores Park", desc: "The ultimate Mission gathering spot for sunbathing and skyline views.", address: "Dolores St & 19th St, San Francisco, CA", hours: "6am – 10pm", tag: "local" },
    { title: "Crissy Field", desc: "Flat, scenic waterfront path from Fort Point to the Marina Green.", address: "1199 East Beach, San Francisco, CA", hours: "Open 24/7", tag: "local" }
  ],
  dating: [
    { title: "Conservatory of Flowers", desc: "Fairytale-like glass greenhouses filled with rare tropical plants.", address: "100 John F Kennedy Dr, San Francisco, CA", hours: "Check current hours", tag: "touristy" },
    { title: "Musée Mécanique", desc: "Nostalgic arcade at Fisherman's Wharf with vintage mechanical games.", address: "Pier 45, Shed A, San Francisco, CA", hours: "Check current hours", tag: "touristy" },
    { title: "Marshall's Beach", desc: "Secluded, romantic beach near the base of the Golden Gate Bridge.", address: "Marshall's Beach Trail, San Francisco, CA", hours: "Open 24/7", tag: "local" }
  ],
  transit: [
    { title: "Golden Rule of Parking", desc: "Never leave anything visible in your car in SF — not even a jacket.", address: "Citywide", hours: "N/A" },
    { title: "Muni & BART", desc: "Use the Muni app or a Clipper card for buses, light rail, and cable cars.", address: "Citywide", hours: "Varies by line — check SFMTA.com" },
    { title: "Embarcadero Walkability", desc: "Much of downtown's waterfront is flat and best explored on foot or bike.", address: "The Embarcadero, San Francisco, CA", hours: "Open 24/7" }
  ],
  stories: [
    { title: "Moving National Landmarks", desc: "SF's cable cars are the only moving National Historic Landmarks in the US." },
    { title: "The Fog Has a Name", desc: "SF's iconic summer fog is affectionately nicknamed 'Karl the Fog.'" },
    { title: "Built on Hills", desc: "San Francisco is built on more than 40 distinct hills." }
  ]
};


// --- 4. NEIGHBORHOOD GUIDES ---
const neighborhoods = {
  richmond: [
    { title: "Lincoln Park & the Legion of Honor", desc: "A quiet clifftop park with an art museum and some of the best ocean views in the city.", address: "100 34th Ave, San Francisco, CA", hours: "Park open 24/7 — museum hours vary", tag: "local" },
    { title: "Green Apple Books", desc: "A sprawling, beloved independent bookstore that's been a Richmond fixture for decades.", address: "506 Clement St, San Francisco, CA", hours: "Check current hours", tag: "local" }
  ],
  marina: [
    { title: "Marina Green", desc: "A wide waterfront lawn packed with joggers, kite-flyers, and Golden Gate Bridge views.", address: "Marina Green Dr, San Francisco, CA", hours: "Open 24/7", tag: "local" },
    { title: "Fillmore Street", desc: "A boutique-lined shopping corridor running through Pacific Heights.", address: "Fillmore St & Sacramento St, San Francisco, CA", hours: "Shops vary — generally 10am–7pm", tag: "local" }
  ],
  telegraphrussian: [
    { title: "Coit Tower", desc: "An Art Deco tower atop Telegraph Hill with panoramic city and bay views.", address: "1 Telegraph Hill Blvd, San Francisco, CA", hours: "Check current hours", tag: "touristy" },
    { title: "Lombard Street", desc: "The famous 'crookedest street in the world,' lined with hydrangeas, in Russian Hill.", address: "Lombard St & Hyde St, San Francisco, CA", hours: "Open 24/7", tag: "touristy" }
  ],
  sunset: [
    { title: "Ocean Beach", desc: "A wide, windswept beach stretching along the Great Highway — better for walking than swimming.", address: "Great Highway, San Francisco, CA", hours: "Open 24/7", tag: "local" },
    { title: "Stern Grove", desc: "A eucalyptus-shaded park known for free summer concerts, tucked into the Sunset.", address: "19th Ave & Sloat Blvd, San Francisco, CA", hours: "Open 24/7 (concerts seasonal)", tag: "local" }
  ],
  haight: [
    { title: "Haight-Ashbury", desc: "The iconic intersection at the heart of 1967's Summer of Love, still full of vintage shops.", address: "Haight St & Ashbury St, San Francisco, CA", hours: "Shops vary", tag: "touristy" },
    { title: "Alamo Square", desc: "Home to the 'Painted Ladies' — the postcard row of Victorian houses with the skyline behind them.", address: "Alamo Square, Steiner St & Hayes St, San Francisco, CA", hours: "Open 24/7", tag: "touristy" }
  ],
  soma: [
    { title: "Oracle Park", desc: "The Giants' waterfront ballpark, with one of the best views in baseball from McCovey Cove.", address: "24 Willie Mays Plaza, San Francisco, CA", hours: "Game days — check current schedule", tag: "local" },
    { title: "Chase Center", desc: "The Warriors' home arena in Mission Bay, hosting games and major concerts.", address: "1 Warriors Way, San Francisco, CA", hours: "Event days — check current schedule", tag: "local" }
  ],
  westportal: [
    { title: "West Portal Avenue", desc: "A small-town-feel shopping strip where the Muni Metro tunnel surfaces above ground.", address: "West Portal Ave, San Francisco, CA", hours: "Shops vary", tag: "local" },
    { title: "Lake Merced", desc: "A calm lake loop popular for walking, running, and rowing in the city's southwest corner.", address: "Lake Merced Blvd, San Francisco, CA", hours: "Open 24/7", tag: "local" }
  ],
  bayview: [
    { title: "Bayview Opera House", desc: "A historic community arts venue and one of the oldest theaters in the city.", address: "4705 3rd St, San Francisco, CA", hours: "Check current hours", tag: "local" },
    { title: "Candlestick Point", desc: "A waterfront state recreation area with fishing, picnic spots, and bay views.", address: "Carroll Ave, San Francisco, CA", hours: "Open 24/7", tag: "local" }
  ],
  castronoe: [
    { title: "Castro Theatre", desc: "A restored 1922 movie palace and the beating heart of the Castro's community and culture.", address: "429 Castro St, San Francisco, CA", hours: "Check current hours", tag: "local" },
    { title: "24th Street, Noe Valley", desc: "A quiet, stroller-friendly shopping strip with cafes, boutiques, and a real small-town feel.", address: "24th St & Castro St, San Francisco, CA", hours: "Shops vary", tag: "local" }
  ],
  excelsior: [
    { title: "McLaren Park", desc: "One of SF's largest parks, with trails, a lake, and an amphitheater — far quieter than Golden Gate Park.", address: "50 John F Shelley Dr, San Francisco, CA", hours: "Open 24/7", tag: "local" },
    { title: "Mission Street, Excelsior", desc: "A lively, diverse commercial corridor with some of the city's best under-the-radar food.", address: "Mission St & Excelsior Ave, San Francisco, CA", hours: "Shops vary", tag: "local" }
  ],
  missionbernal: [
    { title: "Clarion Alley Mural Project", desc: "A full alley of ever-changing, politically charged street murals by local artists.", address: "Clarion Alley, San Francisco, CA", hours: "Open 24/7", tag: "local" },
    { title: "Bernal Heights Park", desc: "Locals just call it 'Bernal Hill' — an off-leash dog hill with 360° views and way fewer crowds than Twin Peaks.", address: "Bernal Heights Blvd, San Francisco, CA", hours: "Open 24/7", tag: "local" }
  ]
};


// --- 5. FILTER PLANNER DATABASE ---
// vibe: "outdoor" | "indoor" | "either" (works for either filter state)
// dogFriendly: true if this is a reasonable spot to bring a dog
const activities = [
  { title: "Dim Sum & Shopping in Chinatown", desc: "Grab cheap pork buns and browse the shops on Grant Ave.", personas: ["teen", "tourist", "parent", "local"], budget: "low", time: "short", address: "Grant Ave, San Francisco, CA", hours: "Shops vary — generally 10am–7pm", vibe: "indoor", dogFriendly: false, tag: "local" },
  { title: "Golden Gate Park Mega-Day", desc: "Rent a boat at Stow Lake, visit the Academy of Sciences, and see the Bison.", personas: ["parent", "tourist"], budget: "high", time: "long", address: "Golden Gate Park, San Francisco, CA", hours: "Park open 24/7 — attraction hours vary", vibe: "outdoor", dogFriendly: false, tag: "touristy" },
  { title: "Sunset at Dolores Park", desc: "Bring a blanket, grab ice cream, and watch the sunset over the city skyline.", personas: ["date", "teen", "local"], budget: "low", time: "short", address: "Dolores St & 19th St, San Francisco, CA", hours: "6am – 10pm", vibe: "outdoor", dogFriendly: true, tag: "local" },
  { title: "Free Museum Day & Ferry Building", desc: "Check out public art spaces, then take Muni to the Ferry Building.", personas: ["tourist", "parent"], budget: "free", time: "long", address: "1 Ferry Building, San Francisco, CA", hours: "Check current hours", vibe: "indoor", dogFriendly: false, tag: "touristy" },
  { title: "Dinner & A Concert Night Out", desc: "Great local dining followed by live music at an intimate venue.", personas: ["date"], budget: "high", time: "long", address: "Hayes Valley, San Francisco, CA", hours: "Evenings — check specific venue", vibe: "indoor", dogFriendly: false, tag: "local" },
  { title: "Hike to the Labyrinth", desc: "Hike the Lands End trail to the secret rock labyrinth. Amazing bridge views.", personas: ["teen", "date", "local"], budget: "free", time: "short", address: "Lands End Trailhead, El Camino Del Mar, San Francisco, CA", hours: "Open 24/7", vibe: "outdoor", dogFriendly: true, tag: "local" },
  { title: "Crissy Field Bike & Beach Walk", desc: "Flat, scenic waterfront path with Golden Gate Bridge views the whole way.", personas: ["parent", "local", "date", "tourist"], budget: "free", time: "short", address: "1199 East Beach, San Francisco, CA", hours: "Open 24/7", vibe: "outdoor", dogFriendly: true, tag: "local" },
  { title: "Dog Walk & Coffee at Duboce Park", desc: "A small, friendly neighborhood dog park with a coffee shop right across the street.", personas: ["local", "date"], budget: "low", time: "short", address: "Duboce Park, San Francisco, CA", hours: "Open 24/7", vibe: "outdoor", dogFriendly: true, tag: "local" },
  { title: "Rainy Day Arcade at Musée Mécanique", desc: "Vintage mechanical arcade games at Fisherman's Wharf — a fun, cheap indoor escape.", personas: ["teen", "date", "tourist"], budget: "low", time: "short", address: "Pier 45, Shed A, San Francisco, CA", hours: "Check current hours", vibe: "indoor", dogFriendly: false, tag: "touristy" },
  { title: "Bernal Hill Sunset Hike", desc: "An off-leash dog hill with 360° views and way fewer crowds than Twin Peaks.", personas: ["local", "date", "teen"], budget: "free", time: "short", address: "Bernal Heights Blvd, San Francisco, CA", hours: "Open 24/7", vibe: "outdoor", dogFriendly: true, tag: "local" },
  { title: "Fancy Tasting Menu Night", desc: "A splurge-worthy multi-course dinner — book ahead for weekend slots.", personas: ["date"], budget: "high", time: "long", address: "Hayes Valley, San Francisco, CA", hours: "Evenings — check specific restaurant", vibe: "indoor", dogFriendly: false, tag: "local" },
  { title: "Exploratorium Rainy Day", desc: "Hands-on science museum on Pier 15 — a great full-day indoor plan when the fog rolls in.", personas: ["parent", "teen", "tourist"], budget: "high", time: "long", address: "Pier 15, San Francisco, CA", hours: "Check current hours", vibe: "indoor", dogFriendly: false, tag: "touristy" },
  { title: "Cable Car Hop & Chinatown Walk", desc: "Ride a historic cable car, then wander Chinatown's alleys and shops.", personas: ["tourist", "teen"], budget: "low", time: "short", address: "Powell St Cable Car Turnaround, San Francisco, CA", hours: "Check current hours", vibe: "outdoor", dogFriendly: false, tag: "touristy" },
  { title: "Local's Day Off: Ocean Beach & Thrift Shopping", desc: "A windswept beach walk followed by browsing Outer Sunset's thrift and vintage shops.", personas: ["local"], budget: "free", time: "long", address: "Great Highway, San Francisco, CA", hours: "Open 24/7", vibe: "outdoor", dogFriendly: true, tag: "local" },
  { title: "Family Picnic at Marina Green", desc: "Wide waterfront lawn with kite-flying, joggers, and Golden Gate Bridge views.", personas: ["parent", "local"], budget: "free", time: "short", address: "Marina Green Dr, San Francisco, CA", hours: "Open 24/7", vibe: "outdoor", dogFriendly: true, tag: "local" },
  { title: "Rainy Day Bookstore Crawl", desc: "Hop between a few of the city's best independent bookstores, coffee in hand.", personas: ["local", "date", "teen"], budget: "free", time: "short", address: "Clement St, San Francisco, CA", hours: "Shops vary", vibe: "indoor", dogFriendly: false, tag: "local" },
  { title: "Big Night Out: SOMA Bar Hop", desc: "A proper night out across a few of SOMA's best bars and lounges.", personas: ["date", "local"], budget: "high", time: "long", address: "SOMA, San Francisco, CA", hours: "Evenings — check specific venues", vibe: "indoor", dogFriendly: false, tag: "local" },
  { title: "Twin Peaks Sunset Walk", desc: "Sweeping 360° views from the geographic center of the city — best at golden hour.", personas: ["tourist", "date", "local"], budget: "free", time: "short", address: "Twin Peaks Blvd, San Francisco, CA", hours: "Open 24/7", vibe: "outdoor", dogFriendly: true, tag: "touristy" }
];


// --- 6. THIS WEEK IN SF — REAL RECURRING WEEKLY EVENTS ---
// Keyed 0 (Sunday) through 6 (Saturday), matching Date.getDay()
const weeklyEvents = {
  0: [
    { title: "Heart of the City Farmers Market", desc: "A large, affordable, community-run market at UN Plaza.", address: "UN Plaza, Market St & Hyde St, San Francisco, CA", hours: "7am – 5pm" },
    { title: "Fort Mason Farmers Market", desc: "Waterfront market at the Fort Mason Center with produce and artisan food stalls.", address: "Fort Mason Center, Marina Blvd, San Francisco, CA", hours: "9:30am – 1:30pm" }
  ],
  1: [
    { title: "A Quieter Day", desc: "No major recurring markets today — a good day to browse our evergreen SF guides below instead." }
  ],
  2: [
    { title: "Ferry Plaza Farmers Market", desc: "A smaller weekday market with fresh produce and lunch options along the Embarcadero.", address: "1 Ferry Building, San Francisco, CA", hours: "10am – 2pm" }
  ],
  3: [
    { title: "Heart of the City Farmers Market", desc: "A large, affordable, community-run market at UN Plaza.", address: "UN Plaza, Market St & Hyde St, San Francisco, CA", hours: "7am – 5pm" },
    { title: "Castro Farmers Market", desc: "Neighborhood evening market along Noe Street. (Seasonal, roughly March–November.)", address: "Noe St & Market St, San Francisco, CA", hours: "4pm – 8pm" }
  ],
  4: [
    { title: "Ferry Plaza Farmers Market", desc: "Street-food-focused weekday market with fresh produce along the Embarcadero.", address: "1 Ferry Building, San Francisco, CA", hours: "10am – 2pm" },
    { title: "Mission Community Market", desc: "Lively evening street market with local produce, food, and crafts.", address: "Mission St & 22nd St, San Francisco, CA", hours: "3pm – 7pm" }
  ],
  5: [
    { title: "A Quieter Day", desc: "No major recurring markets today — a good day to browse our evergreen SF guides below instead." }
  ],
  6: [
    { title: "Ferry Plaza Farmers Market", desc: "The city's biggest and most iconic farmers market, with 100+ vendors overlooking the Bay.", address: "1 Ferry Building, San Francisco, CA", hours: "8am – 2pm" },
    { title: "Alemany Farmers Market", desc: "San Francisco's original, city-run 'people's market' — the oldest in the state.", address: "100 Alemany Blvd, San Francisco, CA", hours: "7am – 3pm" },
    { title: "Noe Valley Farmers Market", desc: "A small, community-run neighborhood market at Noe Valley Town Square.", address: "3861 24th St, San Francisco, CA", hours: "8am – 1pm" }
  ]
};


// --- 7. THIS WEEK'S LOCAL FAVORITE (rotates weekly, no backend needed) ---
const localFavorites = [
  { title: "Trouble Coffee Co.", desc: "A tiny, cult-favorite Outer Sunset coffee shop famous for its cinnamon-toast-and-coconut 'Building.'", address: "4033 Judah St, San Francisco, CA", hours: "Check current hours", tag: "local" },
  { title: "Wild Side West", desc: "A quirky, plant-filled dive bar with a sprawling back garden, tucked into Bernal Heights.", address: "424 Cortland Ave, San Francisco, CA", hours: "Evenings — check current hours", tag: "local" },
  { title: "Arizmendi Bakery", desc: "A worker-owned bakery known for its rotating daily pizza and fresh morning pastries.", address: "1331 9th Ave, San Francisco, CA", hours: "Check current hours", tag: "local" },
  { title: "Homestead", desc: "An old-school Mission bar with pressed-tin ceilings that's been pouring drinks since the 1900s.", address: "2301 Folsom St, San Francisco, CA", hours: "Evenings — check current hours", tag: "local" },
  { title: "Toy Boat Dessert Cafe", desc: "A Richmond District institution — half toy shop, half ice cream counter, all nostalgia.", address: "401 Clement St, San Francisco, CA", hours: "Check current hours", tag: "local" },
  { title: "Bird & Beckett Books and Records", desc: "A Glen Park indie bookstore that doubles as a beloved neighborhood jazz venue on weekends.", address: "653 Chenery St, San Francisco, CA", hours: "Check current hours", tag: "local" }
];

function getWeekNumber(sfStamp) {
  const [y, m, dNum] = sfStamp.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, dNum));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

const weekNum = getWeekNumber(sfDateStamp());
const favoriteOfTheWeek = localFavorites[weekNum % localFavorites.length];
document.getElementById('local-favorite-content').innerHTML = buildVenueCard(favoriteOfTheWeek);


// --- 8. INTERACTIVITY LOGIC ---
const generateBtn = document.getElementById('generate-btn');
const resultsSection = document.getElementById('results-section');
const resultsTitle = document.getElementById('results-title');
const itineraryContent = document.getElementById('itinerary-content');
const closeBtn = document.getElementById('close-btn');
const dashCards = document.querySelectorAll('.dash-card[data-category]');
const neighborhoodCards = document.querySelectorAll('.dash-card[data-neighborhood]');

// Tracks whatever is currently shown in #results-section so the Share/Print
// buttons (and the Surprise Me / quiz code further down) know what to work with.
let currentPlanItems = [];

// Tracks live weather so the planner can bias toward outdoor/indoor picks
let currentWeatherCode = null;
function isGoodOutdoorWeather(code) {
  return code === 0 || code === 1 || code === 2; // clear, mostly clear, partly cloudy
}

// Handle Custom Planner Button
generateBtn.addEventListener('click', function() {
  const p = document.getElementById('persona').value;
  const b = document.getElementById('budget').value;
  const t = document.getElementById('time').value;
  const v = document.getElementById('vibe').value;
  const dogOnly = document.getElementById('dog-friendly').checked;

  let matches = activities.filter(activity => {
    return activity.personas.includes(p) &&
      activity.budget === b &&
      activity.time === t &&
      (v === 'either' || activity.vibe === v) &&
      (!dogOnly || activity.dogFriendly === true);
  });

  let weatherNote = '';
  if (matches.length > 1 && v === 'either' && currentWeatherCode !== null) {
    const goodOutdoor = isGoodOutdoorWeather(currentWeatherCode);
    const preferredVibe = goodOutdoor ? 'outdoor' : 'indoor';

    matches = matches.slice().sort((a, c) => {
      const scoreOf = (item) => item.vibe === preferredVibe ? 0 : (item.vibe === 'either' ? 1 : 2);
      return scoreOf(a) - scoreOf(c);
    });

    weatherNote = goodOutdoor
      ? '<p class="weather-note">☀️ It looks clear out there — we bumped outdoor picks to the top.</p>'
      : '<p class="weather-note">🌫️ Not the best outdoor weather right now — we prioritized indoor-friendly picks.</p>';
  }

  let htmlString = weatherNote;
  if (matches.length > 0) {
    currentPlanItems = matches;
    matches.forEach(match => {
      htmlString += buildVenueCard(match);
    });
  } else {
    const fallbackItem = {
      title: "Explore the Waterfront",
      desc: "You can never go wrong with a classic walk from the Ferry Building to Pier 39!",
      address: "1 Ferry Building, San Francisco, CA",
      hours: "Open 24/7 (outdoor path)"
    };
    currentPlanItems = [fallbackItem];
    htmlString += buildVenueCard(fallbackItem);
  }

  resultsTitle.textContent = "Your Custom Itinerary";
  itineraryContent.innerHTML = htmlString;
  resultsSection.classList.remove('hidden');
  resultsSection.scrollIntoView({ behavior: 'smooth' });
});

// Handle Dashboard Card Clicks (evergreen guides)
dashCards.forEach(card => {
  card.addEventListener('click', function() {
    const categoryKey = this.getAttribute('data-category');
    const cardText = this.textContent;

    if (evergreenCategories[categoryKey]) {
      resultsTitle.textContent = cardText;
      currentPlanItems = evergreenCategories[categoryKey];
      itineraryContent.innerHTML = evergreenCategories[categoryKey].map(buildVenueCard).join('');
      resultsSection.classList.remove('hidden');
      resultsSection.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// Handle Neighborhood Card Clicks
neighborhoodCards.forEach(card => {
  card.addEventListener('click', function() {
    const key = this.getAttribute('data-neighborhood');
    const cardText = this.textContent;

    if (neighborhoods[key]) {
      resultsTitle.textContent = cardText;
      currentPlanItems = neighborhoods[key];
      itineraryContent.innerHTML = neighborhoods[key].map(buildVenueCard).join('');
      resultsSection.classList.remove('hidden');
      resultsSection.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// Handle Close Button
closeBtn.addEventListener('click', function() {
  resultsSection.classList.add('hidden');
});

// --- WEEKLY EVENTS FEED / DAY TABS ---
const dayTabs = document.querySelectorAll('.day-tab');
const weeklyEventsContent = document.getElementById('weekly-events-content');
const todayIndex = sfDayParts().weekday;

function renderDay(dayIndex) {
  const dayEvents = weeklyEvents[dayIndex];

  if (!dayEvents || dayEvents.length === 0) {
    weeklyEventsContent.innerHTML = `<p class="no-events-message">Nothing recurring listed for this day yet.</p>`;
    return;
  }

  weeklyEventsContent.innerHTML = dayEvents.map(buildVenueCard).join('');
}

function setActiveTab(dayIndex) {
  dayTabs.forEach(tab => {
    const tabDay = parseInt(tab.getAttribute('data-day'), 10);
    tab.classList.toggle('active', tabDay === dayIndex);
  });
}

dayTabs.forEach(tab => {
  const tabDay = parseInt(tab.getAttribute('data-day'), 10);

  if (tabDay === todayIndex) {
    tab.classList.add('is-today');
  }

  tab.addEventListener('click', function() {
    setActiveTab(tabDay);
    renderDay(tabDay);
  });
});

setActiveTab(todayIndex);
renderDay(todayIndex);

// --- LIVE SF CLOCK ---
function updateClock() {
  const clockElement = document.getElementById('live-clock');
  const now = new Date();

  const timeString = now.toLocaleTimeString('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  clockElement.textContent = `🕒 Current SF Time: ${timeString}`;
}

updateClock();
setInterval(updateClock, 1000);

// --- LIVE SF WEATHER ---
function weatherCodeToText(code) {
  const map = {
    0: "☀️ Clear",
    1: "🌤️ Mostly Clear",
    2: "⛅ Partly Cloudy",
    3: "☁️ Cloudy",
    45: "🌫️ Foggy",
    48: "🌫️ Foggy",
    51: "🌦️ Light Drizzle",
    61: "🌧️ Light Rain",
    63: "🌧️ Rain",
    65: "🌧️ Heavy Rain",
    71: "🌨️ Snow",
    80: "🌦️ Rain Showers",
    95: "⛈️ Thunderstorm"
  };
  return map[code] || "🌡️ Weather";
}

async function updateWeather() {
  const weatherElement = document.getElementById('weather-widget');
  try {
    const response = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=37.7749&longitude=-122.4194&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=America%2FLos_Angeles'
    );
    const data = await response.json();
    const temp = Math.round(data.current.temperature_2m);
    const code = data.current.weather_code;
    currentWeatherCode = code; // stored so the planner can use it
    const condition = weatherCodeToText(code);
    weatherElement.textContent = `${condition}, ${temp}°F in SF`;
  } catch (error) {
    weatherElement.textContent = "Weather unavailable right now.";
  }
}

updateWeather();
setInterval(updateWeather, 10 * 60 * 1000); // refresh every 10 minutes

// --- STREET SWEEPING LOOKUP (real DataSF public dataset, no API key required) ---
const sweepInput = document.getElementById('sweep-street-input');
const sweepBtn = document.getElementById('sweep-search-btn');
const sweepResults = document.getElementById('sweep-results');

async function checkStreetSweeping() {
  const query = sweepInput.value.trim();

  if (!query) {
    sweepResults.innerHTML = `<p class="no-events-message">Enter a street name first, e.g. "Valencia".</p>`;
    return;
  }

  sweepResults.innerHTML = `<p class="no-events-message">Searching...</p>`;

  try {
    const whereClause = `upper(corridor) like upper('%25${query.replace(/'/g, "''")}%25')`;
    const url = `https://data.sfgov.org/resource/yhqp-riqs.json?$where=${encodeURIComponent(whereClause)}&$limit=15`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data || data.length === 0) {
      sweepResults.innerHTML = `<p class="no-events-message">No matches found. Try just the street name, e.g. "Valencia" instead of "Valencia Street".</p>`;
      return;
    }

    sweepResults.innerHTML = data.map(row => {
      const streetName = row.corridor || 'Unknown Street';
      const side = row.blockside ? `(${row.blockside} side)` : '';
      const limits = row.limits || '';
      const weekday = row.weekday || 'Day varies';
      const fromHour = row.fromhour;
      const toHour = row.tohour;
      const timeRange = (fromHour !== undefined && toHour !== undefined)
        ? `${fromHour}:00 – ${toHour}:00`
        : 'Time varies';

      return `
        <div class="plan-item">
          <h3>${streetName} ${side}</h3>
          <p>${limits}</p>
          <div class="venue-meta">
            <span>🗓️ ${weekday}</span>
            <span>🕒 ${timeRange}</span>
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    sweepResults.innerHTML = `<p class="no-events-message">Couldn't load sweeping data right now. Try again in a moment.</p>`;
  }
}

sweepBtn.addEventListener('click', checkStreetSweeping);
sweepInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    checkStreetSweeping();
  }
});

// --- MUNI SERVICE ALERTS (requires a free 511.org API key) ---
// Get your own free key in ~2 minutes at: https://511.org/open-data/token
// Paste it below in place of "YOUR_511_API_KEY" to turn this feature on.
//
// SECURITY NOTE: once you have a real key, don't ship it in this file as-is —
// anything in client-side JS is visible to anyone who views source, and a
// public key can get rate-limited or abused by other sites. Route this fetch
// through a small serverless proxy instead (a Cloudflare Worker or a Vercel/
// Netlify function both work, and take ~10 minutes to set up) so the key
// stays server-side, and the proxy also sidesteps 511.org's CORS restrictions.
const MUNI_API_KEY = "YOUR_511_API_KEY";

async function loadMuniAlerts() {
  const alertsContent = document.getElementById('muni-alerts-content');

  if (!MUNI_API_KEY || MUNI_API_KEY === "YOUR_511_API_KEY") {
    // Honest "coming soon" state — this is a feature that isn't live yet,
    // not a broken one, so it shouldn't look broken to visitors.
    alertsContent.innerHTML = `
      <div class="coming-soon-box">
        <span class="coming-soon-icon">🚧</span>
        <p><strong>Coming soon.</strong> Live Muni alerts aren't connected yet — check back soon, or see <a href="https://www.sfmta.com/alerts" target="_blank" rel="noopener">sfmta.com/alerts</a> in the meantime.</p>
      </div>
    `;
    return;
  }

  try {
    const url = `https://api.511.org/transit/servicealerts?api_key=${MUNI_API_KEY}&agency=SF&format=json`;
    const response = await fetch(url);
    const text = await response.text();
    // 511.org's API sometimes returns a UTF-16 BOM that breaks JSON.parse — strip it defensively
    const cleaned = text.replace(/^\uFEFF/, '');
    const data = JSON.parse(cleaned);

    const situations = data &&
      data.Siri &&
      data.Siri.ServiceDelivery &&
      data.Siri.ServiceDelivery.SituationExchangeDelivery &&
      data.Siri.ServiceDelivery.SituationExchangeDelivery[0] &&
      data.Siri.ServiceDelivery.SituationExchangeDelivery[0].Situations &&
      data.Siri.ServiceDelivery.SituationExchangeDelivery[0].Situations.PtSituationElement;

    if (!situations || situations.length === 0) {
      alertsContent.innerHTML = `<p class="no-events-message">✅ No active Muni service alerts right now.</p>`;
      return;
    }

    const alertsArray = Array.isArray(situations) ? situations : [situations];

    alertsContent.innerHTML = alertsArray.slice(0, 5).map(alert => `
      <div class="plan-item">
        <h3>${(alert && alert.Summary) || 'Service Alert'}</h3>
        <p>${(alert && alert.Description) || ''}</p>
      </div>
    `).join('');
  } catch (error) {
    alertsContent.innerHTML = `<p class="no-events-message">Couldn't load Muni alerts right now. If this keeps happening, 511.org's API may require a small server-side proxy due to browser CORS restrictions.</p>`;
  }
}

loadMuniAlerts();

// --- DARK MODE TOGGLE ---
const darkToggle = document.getElementById('dark-mode-toggle');

function applyDarkModePreference() {
  try {
    const saved = localStorage.getItem('sftoday-dark-mode');
    if (saved === 'true') {
      document.body.classList.add('dark-mode');
      darkToggle.textContent = '☀️';
    }
  } catch (error) {
    // localStorage unavailable (e.g. private browsing) — default to light mode
  }
}

darkToggle.addEventListener('click', function() {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  darkToggle.textContent = isDark ? '☀️' : '🌙';

  try {
    localStorage.setItem('sftoday-dark-mode', isDark);
  } catch (error) {
    // localStorage unavailable — preference just won't persist across visits
  }
});

applyDarkModePreference();

// --- GUESS THE SF SPOT (rotates daily — a fresh puzzle every day, same for every visitor) ---
const spotPuzzles = [
  {
    acceptableAnswers: ["wave organ", "the wave organ"],
    clues: [
      "You can hear the bay before you see what's making the sound.",
      "It's not a person — it's made of concrete and pipes, some salvaged from a demolished cemetery.",
      "Waves inside the bay push air and water through its pipes, creating strange, gurgling music.",
      "It sits at the end of a small jetty near the Marina, close to the Exploratorium's old home.",
      "Sound is best at high tide — locals call it San Francisco's strangest acoustic sculpture."
    ]
  },
  {
    acceptableAnswers: ["lombard street", "crooked street"],
    clues: [
      "Tourists line up for hours to drive this one block — locals just avoid it.",
      "Eight sharp switchbacks were added in the 1920s to make an impossibly steep hill drivable.",
      "It's lined with hydrangeas that bloom every summer.",
      "It sits between Hyde and Leavenworth Streets, atop Russian Hill.",
      "It's famous as the 'crookedest street in the world' — though a street in Vermont technically disputes that title."
    ]
  },
  {
    acceptableAnswers: ["bernal heights park", "bernal hill", "bernal heights"],
    clues: [
      "Locals hike it off-leash with their dogs most mornings.",
      "It's a grassy hill, not a building — no admission, no gift shop.",
      "You get a 360° view of the city without the crowds of a more famous hill nearby.",
      "The neighborhood around it shares its name and sits just south of the Mission.",
      "On clear days you can see all the way to the Bay Bridge from the top."
    ]
  },
  {
    acceptableAnswers: ["clarion alley", "clarion alley mural project"],
    clues: [
      "It's one block long, and every inch of it is covered in paint.",
      "The murals here change constantly — what you see this month may be gone by next.",
      "It's run by a nonprofit collective of local artists, not the city.",
      "It runs between two more famous streets in the Mission District.",
      "It's often mentioned in the same breath as Balmy Alley, its older sibling a few blocks away."
    ]
  },
  {
    acceptableAnswers: ["sutro baths", "sutro bath ruins"],
    clues: [
      "What's left today are just concrete foundations, half-swallowed by the ocean.",
      "It was once the world's largest indoor swimming facility, built by a former SF mayor.",
      "A fire destroyed it in the late 1960s, and it was never rebuilt.",
      "It sits right next to the Cliff House, at the northwest edge of the city.",
      "At low tide, you can still walk through the old tunnels and tide pools."
    ]
  }
];

const spotPuzzle = spotPuzzles[sfDayOfYear() % spotPuzzles.length];

let spotClueIndex = 0;
let spotGameOver = false;

const spotClueList = document.getElementById('spot-clue-list');
const spotGuessInput = document.getElementById('spot-guess-input');
const spotGuessBtn = document.getElementById('spot-guess-btn');
const spotFeedback = document.getElementById('spot-feedback');
const spotResult = document.getElementById('spot-result');
const spotRevealBtn = document.getElementById('spot-reveal-btn');
const spotStreakEl = document.getElementById('spot-streak');

// --- Streak tracking (stored only in this browser via localStorage — never sent anywhere) ---
const STREAK_KEY = 'sftoday-spot-streak';
const LAST_WIN_KEY = 'sftoday-spot-last-win';
const LAST_PLAYED_KEY = 'sftoday-spot-last-played';

function todayStamp() {
  return sfDateStamp(); // "YYYY-MM-DD" in San Francisco's actual calendar day
}

function yesterdayStamp() {
  return sfYesterdayStamp();
}

function getStreak() {
  try {
    return parseInt(localStorage.getItem(STREAK_KEY) || '0', 10);
  } catch (error) {
    return 0;
  }
}

function renderStreak() {
  if (!spotStreakEl) return;
  const streak = getStreak();
  if (streak > 0) {
    spotStreakEl.textContent = `🔥 ${streak} day streak`;
    spotStreakEl.classList.remove('hidden');
  } else {
    spotStreakEl.classList.add('hidden');
  }
}

function recordWin() {
  try {
    const lastWin = localStorage.getItem(LAST_WIN_KEY);
    const current = getStreak();
    const isConsecutive = lastWin === yesterdayStamp();
    const newStreak = isConsecutive ? current + 1 : 1;
    localStorage.setItem(STREAK_KEY, String(newStreak));
    localStorage.setItem(LAST_WIN_KEY, todayStamp());
  } catch (error) {
    // localStorage unavailable — streak just won't persist
  }
  renderStreak();
}

function alreadyPlayedToday() {
  try {
    return localStorage.getItem(LAST_PLAYED_KEY) === todayStamp();
  } catch (error) {
    return false;
  }
}

function markPlayedToday() {
  try {
    localStorage.setItem(LAST_PLAYED_KEY, todayStamp());
  } catch (error) {
    // localStorage unavailable — fine, just won't be remembered
  }
}

function renderSpotClues() {
  spotClueList.innerHTML = spotPuzzle.clues
    .slice(0, spotClueIndex + 1)
    .map(clue => `<li>${clue}</li>`)
    .join('');
}

function buildSpotShareText(won) {
  const total = spotPuzzle.clues.length;
  const cluesSeen = spotClueIndex + 1;
  const squares = Array.from({ length: total }, (_, i) => {
    if (i < cluesSeen - 1) return '🟨';
    if (i === cluesSeen - 1) return won ? '🟩' : '⬛';
    return '⬛';
  }).join('');
  const status = won ? `Solved in ${cluesSeen}/${total} clues` : `Stumped after ${total} clues`;
  return `SF Today — Guess the Spot\n${status}\n${squares}`;
}

function endSpotGame(won) {
  spotGameOver = true;
  spotGuessInput.disabled = true;
  spotGuessBtn.disabled = true;
  spotRevealBtn.classList.add('hidden');
  markPlayedToday();
  if (won) {
    recordWin();
    if (typeof launchConfetti === 'function') launchConfetti();
  }

  const answerText = spotPuzzle.acceptableAnswers[0]
    .replace(/\b\w/g, c => c.toUpperCase());
  const shareText = buildSpotShareText(won);

  spotFeedback.textContent = won ? '🎉 You got it!' : `The answer was: ${answerText}`;

  spotResult.classList.remove('hidden');
  spotResult.innerHTML = `
    <div class="spot-result-box">
      <h3>${won ? "Nice work!" : "So close!"}</h3>
      <div class="spot-share-grid">${shareText.split('\n')[2]}</div>
      <p>${shareText.split('\n')[1]}</p>
      <button id="spot-copy-btn" class="secondary-btn">Share Result</button>
    </div>
  `;

  document.getElementById('spot-copy-btn').addEventListener('click', function() {
    const btn = this;
    // Prefer the native share sheet on mobile when available, fall back to clipboard on desktop
    if (navigator.share) {
      navigator.share({ text: shareText }).catch(() => {
        // User cancelled the share sheet — no error state needed
      });
      return;
    }
    navigator.clipboard.writeText(shareText).then(() => {
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Share Result'; }, 2000);
    }).catch(() => {
      btn.textContent = "Couldn't copy — try manually";
    });
  });
}

function checkSpotGuess() {
  if (spotGameOver) return;

  const guess = spotGuessInput.value.trim().toLowerCase();
  if (!guess) return;

  if (spotPuzzle.acceptableAnswers.includes(guess)) {
    endSpotGame(true);
    return;
  }

  spotGuessInput.value = '';

  if (spotClueIndex < spotPuzzle.clues.length - 1) {
    spotClueIndex++;
    renderSpotClues();
    spotFeedback.textContent = "Not quite — here's another clue.";
  } else {
    endSpotGame(false);
  }
}

spotGuessBtn.addEventListener('click', checkSpotGuess);
spotGuessInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    checkSpotGuess();
  }
});
spotRevealBtn.addEventListener('click', function() {
  spotClueIndex = spotPuzzle.clues.length - 1;
  renderSpotClues();
  endSpotGame(false);
});

renderSpotClues();
renderStreak();

if (alreadyPlayedToday()) {
  spotFeedback.textContent = "You've already played today's spot — come back tomorrow for a new one!";
  spotGuessInput.disabled = true;
  spotGuessBtn.disabled = true;
  spotRevealBtn.classList.add('hidden');
}

// --- EMAIL SIGNUP ---
// Two supported modes, same pattern as the feedback form:
//  1) Set a real Formspree (or Mailchimp/Buttondown/ConvertKit) form action
//     on the <form id="signup-form"> in index.html, and this submits for real.
//  2) Until that's set up, it falls back to opening the visitor's email client
//     addressed to SF Today — never shows a fake "success" message.
const signupForm = document.getElementById('signup-form');
const signupModalOverlay = document.getElementById('signup-modal-overlay');
const modalEmailText = document.getElementById('modal-email-text');
const modalCloseBtn = document.getElementById('modal-close-btn');
const SFTODAY_CONTACT_EMAIL = "sftoday@gmail.com";

signupForm.addEventListener('submit', function(e) {
  const actionUrl = signupForm.getAttribute('action') || '';
  const email = document.getElementById('signup-email').value;

  if (!actionUrl || actionUrl.includes('YOUR_FORM_ID')) {
    // No real mailing list connected yet — be honest about that instead of
    // pretending the signup worked. Offer the email fallback so it's still useful.
    e.preventDefault();
    const subject = encodeURIComponent('Add me to the SF Today list');
    const body = encodeURIComponent(`Please add this email to the weekly list: ${email}`);
    modalEmailText.textContent = `Our mailing list isn't live yet — we've opened your email app so you can send this to ${SFTODAY_CONTACT_EMAIL} and we'll add you by hand for now.`;
    signupModalOverlay.classList.remove('hidden');
    if (typeof launchConfetti === 'function') launchConfetti();
    window.location.href = `mailto:${SFTODAY_CONTACT_EMAIL}?subject=${subject}&body=${body}`;
    signupForm.reset();
    return;
  }

  // A real form action is configured — let it submit normally, then show a
  // genuine confirmation on return (handled by the form's own redirect/thanks page).
});

modalCloseBtn.addEventListener('click', function() {
  signupModalOverlay.classList.add('hidden');
});

signupModalOverlay.addEventListener('click', function(e) {
  if (e.target === signupModalOverlay) {
    signupModalOverlay.classList.add('hidden');
  }
});

// --- SHARE / PRINT THE CURRENT PLAN ---
const sharePlanBtn = document.getElementById('share-plan-btn');
const printPlanBtn = document.getElementById('print-plan-btn');

function buildPlanShareText(title, items) {
  const lines = items.map(item => `• ${item.title}${item.address ? ' — ' + item.address : ''}`);
  return `${title} — via SF Today\n${lines.join('\n')}`;
}

if (sharePlanBtn) {
  sharePlanBtn.addEventListener('click', function() {
    if (!currentPlanItems.length) return;
    const text = buildPlanShareText(resultsTitle.textContent, currentPlanItems);

    if (navigator.share) {
      navigator.share({ text }).catch(() => {});
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      const original = sharePlanBtn.textContent;
      sharePlanBtn.textContent = '✅';
      setTimeout(() => { sharePlanBtn.textContent = original; }, 1500);
    }).catch(() => {});
  });
}

if (printPlanBtn) {
  printPlanBtn.addEventListener('click', function() {
    window.print();
  });
}


// --- "SURPRISE ME" — INSTANT RANDOM PICK ---
const surpriseBtn = document.getElementById('surprise-btn');

if (surpriseBtn) {
  surpriseBtn.addEventListener('click', function() {
    const categoryKeys = Object.keys(evergreenCategories);
    const randomCategory = categoryKeys[Math.floor(Math.random() * categoryKeys.length)];
    const options = evergreenCategories[randomCategory];
    const pick = options[Math.floor(Math.random() * options.length)];

    currentPlanItems = [pick];
    resultsTitle.textContent = "🎲 Your Random Pick";
    itineraryContent.innerHTML = buildVenueCard(pick);
    resultsSection.classList.remove('hidden');
    resultsSection.scrollIntoView({ behavior: 'smooth' });
    if (typeof launchConfetti === 'function') launchConfetti();
  });
}


// --- SUNSET & GOLDEN HOUR (sunrise-sunset.org — free, no key required) ---
const sunsetContent = document.getElementById('sunset-content');
let sunsetTime = null;

function formatSFTime(date) {
  return date.toLocaleTimeString('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function renderSunsetCountdown() {
  if (!sunsetTime || !sunsetContent) return;
  const now = new Date();
  const diffMs = sunsetTime - now;

  if (diffMs <= 0) {
    sunsetContent.innerHTML = `<p>Today's sunset already happened at <strong>${formatSFTime(sunsetTime)}</strong>. Catch golden hour tomorrow instead!</p>`;
    return;
  }

  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const countdownText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  const goldenHourStart = new Date(sunsetTime.getTime() - 60 * 60000);

  sunsetContent.innerHTML = `
    <p><strong>Sunset today:</strong> ${formatSFTime(sunsetTime)} <span class="no-events-message" style="display:inline;">(in ${countdownText})</span></p>
    <p><strong>Golden hour starts around:</strong> ${formatSFTime(goldenHourStart)}</p>
  `;
}

async function loadSunsetTime() {
  if (!sunsetContent) return;
  try {
    const response = await fetch(
      'https://api.sunrise-sunset.org/json?lat=37.7749&lng=-122.4194&formatted=0'
    );
    const data = await response.json();
    if (data.status !== 'OK') throw new Error('Unexpected API response');
    sunsetTime = new Date(data.results.sunset);
    renderSunsetCountdown();
  } catch (error) {
    sunsetContent.innerHTML = `<p class="no-events-message">Couldn't load today's sunset time right now.</p>`;
  }
}

loadSunsetTime();
setInterval(renderSunsetCountdown, 60 * 1000); // keep the countdown fresh every minute


// --- KARL THE FOG METER (derived from the weather already fetched in script.js) ---
const fogMeterFill = document.getElementById('fog-meter-fill');
const fogMeterStatus = document.getElementById('fog-meter-status');

function fogLevelForCode(code) {
  // { percent, label }
  if (code === 45 || code === 48) return { percent: 95, label: "🌫️ Karl is fully here. Bring a jacket." };
  if (code === 3) return { percent: 60, label: "☁️ Overcast — Karl might be lurking nearby." };
  if (code === 2) return { percent: 35, label: "⛅ Partly cloudy — Karl's keeping his distance." };
  if (code === 0 || code === 1) return { percent: 8, label: "☀️ Clear skies — Karl's taking the day off." };
  if ([61, 63, 65, 51, 80, 95].includes(code)) return { percent: 50, label: "🌧️ Rain, not fog — different kind of gray sky." };
  return { percent: 30, label: "Reading current conditions..." };
}

function renderFogMeter() {
  if (!fogMeterFill || !fogMeterStatus) return;
  if (currentWeatherCode === null || currentWeatherCode === undefined) {
    fogMeterStatus.textContent = 'Reading current conditions...';
    return;
  }
  const level = fogLevelForCode(currentWeatherCode);
  fogMeterFill.style.width = `${level.percent}%`;
  fogMeterStatus.textContent = level.label;
}

// currentWeatherCode is set asynchronously by script.js's updateWeather() — poll
// briefly until it's available, then keep the meter in sync going forward.
const fogMeterInterval = setInterval(() => {
  if (currentWeatherCode !== null && currentWeatherCode !== undefined) {
    renderFogMeter();
  }
}, 5000);
renderFogMeter();


// --- WEATHER-IMPROVED TOAST ---
// Lets a visitor who's had the tab open know when skies have cleared up,
// without them needing to keep checking the header manually.
let lastKnownWeatherCode = null;
let hasSeenFirstWeatherReading = false;

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'sf-toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('sf-toast-visible'), 10);
  setTimeout(() => {
    toast.classList.remove('sf-toast-visible');
    setTimeout(() => toast.remove(), 400);
  }, 6000);
}

setInterval(() => {
  if (currentWeatherCode === null || currentWeatherCode === undefined) return;

  if (!hasSeenFirstWeatherReading) {
    lastKnownWeatherCode = currentWeatherCode;
    hasSeenFirstWeatherReading = true;
    return;
  }

  const wasGood = isGoodOutdoorWeather(lastKnownWeatherCode);
  const isGood = isGoodOutdoorWeather(currentWeatherCode);

  if (!wasGood && isGood) {
    showToast('☀️ Skies just cleared up in SF — good time for something outdoors.');
  }

  lastKnownWeatherCode = currentWeatherCode;
}, 30 * 1000);


// --- SF TRIVIA OF THE DAY (rotates daily, same fact for everyone) ---
const triviaFacts = [
  "SF's cable cars are the only moving National Historic Landmark in the country.",
  "San Francisco is built across more than 40 hills — some streets are steep enough that they're actually stairs.",
  "The Golden Gate Bridge isn't golden — it's painted 'International Orange,' chosen partly because it stands out in the fog.",
  "Lombard Street's famous switchbacks were added in the 1920s just to make an impossibly steep block drivable.",
  "The Ferry Building survived the 1906 earthquake largely intact, even as much of the city around it burned.",
  "Alcatraz's lighthouse, built in 1854, was the first operating lighthouse on the U.S. West Coast.",
  "The 1967 'Summer of Love' centered on the Haight-Ashbury intersection, drawing an estimated 100,000 young people to the city.",
  "Sutro Baths was once the largest indoor swimming facility in the world — only its concrete ruins remain today, near the Cliff House.",
  "SF's famous fog has a name, 'Karl,' popularized by a local Twitter/Instagram account rather than any official source.",
  "The Transamerica Pyramid, finished in 1972, was controversial when built — many locals thought it clashed badly with the skyline.",
  "Coit Tower was funded by Lillie Hitchcock Coit, an eccentric SF socialite obsessed with firefighters after they saved her life as a child.",
  "San Francisco banned cars from part of Golden Gate Park's JFK Drive permanently after testing it during the pandemic proved popular."
];

const triviaContent = document.getElementById('trivia-content');
if (triviaContent) {
  const fact = triviaFacts[sfDayOfYear() % triviaFacts.length];
  triviaContent.innerHTML = `<p>💡 ${fact}</p>`;
}


// --- GEOLOCATION: FIND MY NEAREST NEIGHBORHOOD ---
// Approximate center coordinates for each neighborhood card. Used only to
// compute a rough distance in the visitor's own browser — nothing is sent
// anywhere or stored.
const neighborhoodCoords = {
  richmond: { lat: 37.7806, lng: -122.4644 },
  marina: { lat: 37.8030, lng: -122.4377 },
  telegraphrussian: { lat: 37.8021, lng: -122.4058 },
  sunset: { lat: 37.7524, lng: -122.4938 },
  haight: { lat: 37.7692, lng: -122.4481 },
  soma: { lat: 37.7785, lng: -122.4056 },
  westportal: { lat: 37.7405, lng: -122.4668 },
  bayview: { lat: 37.7358, lng: -122.3826 },
  castronoe: { lat: 37.7609, lng: -122.4350 },
  excelsior: { lat: 37.7245, lng: -122.4310 },
  missionbernal: { lat: 37.7509, lng: -122.4136 }
};

function haversineMiles(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => deg * (Math.PI / 180);
  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const geoNearestBtn = document.getElementById('geo-nearest-btn');
const geoResultMessage = document.getElementById('geo-result-message');

if (geoNearestBtn) {
  geoNearestBtn.addEventListener('click', function() {
    if (!navigator.geolocation) {
      geoResultMessage.textContent = "Your browser doesn't support location lookup.";
      geoResultMessage.classList.remove('hidden');
      return;
    }

    geoNearestBtn.disabled = true;
    geoResultMessage.textContent = 'Locating you...';
    geoResultMessage.classList.remove('hidden');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        let closestKey = null;
        let closestDistance = Infinity;

        Object.keys(neighborhoodCoords).forEach((key) => {
          const coords = neighborhoodCoords[key];
          const distance = haversineMiles(latitude, longitude, coords.lat, coords.lng);
          if (distance < closestDistance) {
            closestDistance = distance;
            closestKey = key;
          }
        });

        document.querySelectorAll('.dash-card[data-neighborhood]').forEach((card) => {
          card.classList.remove('dash-card-highlight');
          const existingBadge = card.querySelector('.nearest-badge');
          if (existingBadge) existingBadge.remove();
        });

        const matchCard = document.querySelector(`.dash-card[data-neighborhood="${closestKey}"]`);
        if (matchCard) {
          matchCard.classList.add('dash-card-highlight');
          const badge = document.createElement('span');
          badge.className = 'nearest-badge';
          badge.textContent = '📍 Closest to you';
          matchCard.appendChild(badge);
          matchCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        geoResultMessage.textContent = `You're closest to ${matchCard ? matchCard.textContent.replace('📍 Closest to you', '').trim() : 'this neighborhood'} — about ${closestDistance.toFixed(1)} miles away.`;
        geoNearestBtn.disabled = false;
      },
      (error) => {
        geoResultMessage.textContent = 'Could not get your location — check your browser or device location permissions.';
        geoNearestBtn.disabled = false;
      },
      { timeout: 10000 }
    );
  });
}


// --- "WHICH SF NEIGHBORHOOD ARE YOU?" QUIZ ---
const quizQuestions = [
  {
    prompt: "Pick a Saturday morning:",
    options: [
      { text: "Farmers market, then coffee", points: ["missionbernal", "castronoe"] },
      { text: "A quiet walk by the beach", points: ["sunset", "richmond"] },
      { text: "Brunch with a view", points: ["telegraphrussian", "marina"] },
      { text: "Sleep in, no rush", points: ["westportal", "excelsior"] }
    ]
  },
  {
    prompt: "Pick a vibe:",
    options: [
      { text: "Artsy, colorful murals", points: ["missionbernal"] },
      { text: "Postcard-perfect Victorians", points: ["haight", "castronoe"] },
      { text: "Waterfront and sailboats", points: ["marina"] },
      { text: "Foggy and mellow", points: ["sunset", "richmond"] }
    ]
  },
  {
    prompt: "Friday night plans?",
    options: [
      { text: "Bar hopping with friends", points: ["missionbernal", "soma"] },
      { text: "Live jazz or a classic movie theater", points: ["castronoe", "excelsior"] },
      { text: "Quiet dinner at home", points: ["westportal", "bayview"] },
      { text: "Rooftop drinks with a skyline view", points: ["telegraphrussian", "soma"] }
    ]
  },
  {
    prompt: "Your ideal day off:",
    options: [
      { text: "Hike a hill for the view", points: ["missionbernal", "telegraphrussian"] },
      { text: "Browse bookstores and thrift shops", points: ["richmond", "haight"] },
      { text: "Catch a ballgame or big event", points: ["soma"] },
      { text: "A long walk somewhere peaceful", points: ["westportal", "bayview"] }
    ]
  },
  {
    prompt: "Pick a food craving:",
    options: [
      { text: "A classic Mission burrito", points: ["missionbernal"] },
      { text: "Dim sum", points: ["richmond"] },
      { text: "A fancy tasting menu", points: ["telegraphrussian", "castronoe"] },
      { text: "A no-frills neighborhood diner", points: ["westportal", "excelsior"] }
    ]
  }
];

const neighborhoodNames = {
  richmond: "🌫️ Inner / Outer Richmond",
  marina: "⛵ Marina / Pacific Heights",
  telegraphrussian: "🗼 Telegraph Hill / Russian Hill",
  sunset: "🌊 Inner / Outer Sunset",
  haight: "🌈 Haight / Western Addition",
  soma: "🏟️ SOMA / Mission Bay",
  westportal: "🚋 West Portal / Lake Merced",
  bayview: "🌉 Bayview / Hunters Point",
  castronoe: "🏳️‍🌈 Castro / Noe Valley",
  excelsior: "🏘️ Excelsior / Outer Mission",
  missionbernal: "🌮 Mission / Bernal Heights"
};

// Tie-break order when two neighborhoods score equally
const neighborhoodPriority = ["missionbernal", "castronoe", "telegraphrussian", "haight", "richmond", "sunset", "marina", "soma", "westportal", "bayview", "excelsior"];

let quizScores = {};
let quizQuestionIndex = 0;

const quizModalOverlay = document.getElementById('quiz-modal-overlay');
const quizContent = document.getElementById('quiz-content');
const quizStartBtn = document.getElementById('quiz-start-btn');
const quizCloseBtn = document.getElementById('quiz-close-btn');

function renderQuizQuestion() {
  const question = quizQuestions[quizQuestionIndex];
  quizContent.innerHTML = `
    <p class="quiz-progress">Question ${quizQuestionIndex + 1} of ${quizQuestions.length}</p>
    <h3 class="quiz-prompt">${question.prompt}</h3>
    <div class="quiz-options">
      ${question.options.map((opt, i) => `<button type="button" class="quiz-option-btn" data-index="${i}">${opt.text}</button>`).join('')}
    </div>
  `;

  quizContent.querySelectorAll('.quiz-option-btn').forEach((btn) => {
    btn.addEventListener('click', function() {
      const optionIndex = parseInt(this.getAttribute('data-index'), 10);
      const chosen = question.options[optionIndex];
      chosen.points.forEach((key) => {
        quizScores[key] = (quizScores[key] || 0) + 1;
      });

      quizQuestionIndex++;
      if (quizQuestionIndex < quizQuestions.length) {
        renderQuizQuestion();
      } else {
        renderQuizResult();
      }
    });
  });
}

function renderQuizResult() {
  let winningKey = neighborhoodPriority[0];
  let winningScore = -1;
  neighborhoodPriority.forEach((key) => {
    const score = quizScores[key] || 0;
    if (score > winningScore) {
      winningScore = score;
      winningKey = key;
    }
  });

  const resultName = neighborhoodNames[winningKey];
  const shareText = `I got ${resultName} on SF Today's "Which SF Neighborhood Are You?" quiz!`;

  quizContent.innerHTML = `
    <p class="quiz-progress">Your result</p>
    <h3 class="quiz-prompt">You're ${resultName}!</h3>
    <p class="quiz-result-desc">Based on your answers, this is the SF neighborhood that fits your vibe best.</p>
    <div class="quiz-result-actions">
      <button type="button" id="quiz-see-guide-btn" class="secondary-btn">See the Guide</button>
      <button type="button" id="quiz-share-btn" class="secondary-btn">Share Result</button>
      <button type="button" id="quiz-retake-btn" class="secondary-btn">Retake Quiz</button>
    </div>
  `;

  if (typeof launchConfetti === 'function') launchConfetti();

  document.getElementById('quiz-see-guide-btn').addEventListener('click', function() {
    closeQuiz();
    if (neighborhoods[winningKey]) {
      resultsTitle.textContent = resultName;
      currentPlanItems = neighborhoods[winningKey];
      itineraryContent.innerHTML = neighborhoods[winningKey].map(buildVenueCard).join('');
      resultsSection.classList.remove('hidden');
      resultsSection.scrollIntoView({ behavior: 'smooth' });
    }
  });

  document.getElementById('quiz-share-btn').addEventListener('click', function() {
    if (navigator.share) {
      navigator.share({ text: shareText }).catch(() => {});
      return;
    }
    navigator.clipboard.writeText(shareText).then(() => {
      const btn = document.getElementById('quiz-share-btn');
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Share Result'; }, 1500);
    }).catch(() => {});
  });

  document.getElementById('quiz-retake-btn').addEventListener('click', function() {
    startQuiz();
  });
}

function startQuiz() {
  quizScores = {};
  quizQuestionIndex = 0;
  renderQuizQuestion();
  quizModalOverlay.classList.remove('hidden');
}

function closeQuiz() {
  quizModalOverlay.classList.add('hidden');
}

if (quizStartBtn) {
  quizStartBtn.addEventListener('click', startQuiz);
}
if (quizCloseBtn) {
  quizCloseBtn.addEventListener('click', closeQuiz);
}
if (quizModalOverlay) {
  quizModalOverlay.addEventListener('click', function(e) {
    if (e.target === quizModalOverlay) closeQuiz();
  });
}


// --- MY SF CHECKLIST (bucket-list tracker) ---
// Every venue card across the site gets a "Mark as visited" toggle (added in
// buildVenueCard, script.js). Progress is stored only in this browser via
// localStorage — never sent anywhere — same pattern as the game's streak.
const VISITED_KEY = 'sftoday-visited';
const MILESTONE_KEY = 'sftoday-checklist-milestone';
const checklistProgressLabel = document.getElementById('checklist-progress-label');
const checklistOpenBtn = document.getElementById('checklist-open-btn');
const checklistModalOverlay = document.getElementById('checklist-modal-overlay');
const checklistCloseBtn = document.getElementById('checklist-close-btn');
const checklistList = document.getElementById('checklist-list');
const checklistProgressText = document.getElementById('checklist-progress-text');
const checklistClearBtn = document.getElementById('checklist-clear-btn');

// Build the full universe of visitable spots once, deduplicated by slug —
// this is what "100%" means. Facts/tips without a real single address don't count.
function buildAllVisitableItems() {
  const all = [];
  Object.values(evergreenCategories).forEach((list) => all.push(...list));
  Object.values(neighborhoods).forEach((list) => all.push(...list));
  Object.values(weeklyEvents).forEach((list) => all.push(...list));
  all.push(...localFavorites);
  all.push(...activities);
  const seen = new Map();
  all.forEach((item) => {
    if (!isRealVisitablePlace(item)) return;
    const slug = slugify(item.title);
    if (!seen.has(slug)) seen.set(slug, item);
  });
  return seen; // Map<slug, item>
}

const allVisitableItems = buildAllVisitableItems();
const TOTAL_VISITABLE_SPOTS = allVisitableItems.size;

function getVisitedCount() {
  const map = getVisitedMap();
  return Object.keys(map).filter((slug) => map[slug]).length;
}

function updateChecklistProgressLabel() {
  if (checklistProgressLabel) {
    checklistProgressLabel.textContent = `${getVisitedCount()}/${TOTAL_VISITABLE_SPOTS}`;
  }
}

function saveVisitedMap(map) {
  try {
    localStorage.setItem(VISITED_KEY, JSON.stringify(map));
  } catch (error) {
    // localStorage unavailable — progress just won't persist
  }
}

function checkMilestones() {
  const percent = TOTAL_VISITABLE_SPOTS > 0
    ? Math.floor((getVisitedCount() / TOTAL_VISITABLE_SPOTS) * 100)
    : 0;
  const milestones = [25, 50, 75, 100];
  let lastCelebrated = 0;
  try {
    lastCelebrated = parseInt(localStorage.getItem(MILESTONE_KEY) || '0', 10);
  } catch (error) {
    lastCelebrated = 0;
  }

  const hitMilestone = milestones.filter((m) => percent >= m && m > lastCelebrated).pop();
  if (hitMilestone) {
    try {
      localStorage.setItem(MILESTONE_KEY, String(hitMilestone));
    } catch (error) {
      // fine, just won't persist
    }
    if (typeof launchConfetti === 'function') launchConfetti();
    showToast(hitMilestone === 100
      ? `🏆 You've marked every spot on SF Today as visited!`
      : `🎉 ${hitMilestone}% of SF Today explored — keep going!`);
  }
}

// Delegated so it works no matter which container the card was rendered into
document.addEventListener('click', function(e) {
  const btn = e.target.closest('.visited-toggle');
  if (!btn) return;

  const slug = btn.getAttribute('data-slug');
  const map = getVisitedMap();
  const nowVisited = !map[slug];
  map[slug] = nowVisited;
  saveVisitedMap(map);

  btn.classList.toggle('visited', nowVisited);
  btn.textContent = nowVisited ? '✓ Been there' : 'Mark as visited';

  updateChecklistProgressLabel();
  if (nowVisited) checkMilestones();
  if (!checklistModalOverlay.classList.contains('hidden')) renderChecklistModal();
});

function renderChecklistModal() {
  const map = getVisitedMap();
  const visitedSlugs = Object.keys(map).filter((slug) => map[slug]);

  checklistProgressText.textContent = `${visitedSlugs.length} of ${TOTAL_VISITABLE_SPOTS} spots marked as visited.`;

  if (visitedSlugs.length === 0) {
    checklistList.innerHTML = `<p class="search-empty-message">Nothing marked yet — tap "Mark as visited" on any spot across the site to start your list.</p>`;
    return;
  }

  checklistList.innerHTML = visitedSlugs.map((slug) => {
    const item = allVisitableItems.get(slug);
    const title = item ? item.title : slug;
    return `
      <div class="checklist-row">
        <span>✓ ${title}</span>
        <button type="button" class="checklist-row-remove" data-slug="${slug}" aria-label="Remove ${title}">&times;</button>
      </div>
    `;
  }).join('');
}

if (checklistList) {
  checklistList.addEventListener('click', function(e) {
    const btn = e.target.closest('.checklist-row-remove');
    if (!btn) return;
    const slug = btn.getAttribute('data-slug');
    const map = getVisitedMap();
    map[slug] = false;
    saveVisitedMap(map);
    updateChecklistProgressLabel();

    // Sync any matching toggle currently rendered on the page
    document.querySelectorAll(`.visited-toggle[data-slug="${slug}"]`).forEach((toggleBtn) => {
      toggleBtn.classList.remove('visited');
      toggleBtn.textContent = 'Mark as visited';
    });

    renderChecklistModal();
  });
}

if (checklistOpenBtn) {
  checklistOpenBtn.addEventListener('click', function() {
    renderChecklistModal();
    checklistModalOverlay.classList.remove('hidden');
  });
}
if (checklistCloseBtn) {
  checklistCloseBtn.addEventListener('click', function() {
    checklistModalOverlay.classList.add('hidden');
  });
}
if (checklistModalOverlay) {
  checklistModalOverlay.addEventListener('click', function(e) {
    if (e.target === checklistModalOverlay) checklistModalOverlay.classList.add('hidden');
  });
}
if (checklistClearBtn) {
  checklistClearBtn.addEventListener('click', function() {
    if (!confirm("Clear your entire SF Checklist? This can't be undone.")) return;
    saveVisitedMap({});
    document.querySelectorAll('.visited-toggle.visited').forEach((toggleBtn) => {
      toggleBtn.classList.remove('visited');
      toggleBtn.textContent = 'Mark as visited';
    });
    updateChecklistProgressLabel();
    renderChecklistModal();
  });
}

updateChecklistProgressLabel();


// --- SITE-WIDE QUICK FIND (SEARCH) ---
const searchOpenBtn = document.getElementById('search-open-btn');
const searchModalOverlay = document.getElementById('search-modal-overlay');
const searchCloseBtn = document.getElementById('search-close-btn');
const searchInput = document.getElementById('search-input');
const searchResultsEl = document.getElementById('search-results');

function buildSearchIndex() {
  const index = [];

  Object.entries(evergreenCategories).forEach(([key, items]) => {
    items.forEach((item) => {
      index.push({ title: item.title, meta: 'Guide', desc: item.desc, type: 'venue', item });
    });
  });

  Object.entries(neighborhoods).forEach(([key, items]) => {
    items.forEach((item) => {
      index.push({ title: item.title, meta: 'Neighborhood spot', desc: item.desc, type: 'venue', item });
    });
  });

  document.querySelectorAll('#faq-section .glossary-item').forEach((el) => {
    const question = el.querySelector('summary')?.textContent || '';
    const desc = el.querySelector('p')?.textContent || '';
    index.push({ title: question, meta: 'FAQ', desc, type: 'detail', element: el });
  });

  return index;
}

let searchIndex = [];

function renderSearchResults(query) {
  const q = query.trim().toLowerCase();
  if (!q) {
    searchResultsEl.innerHTML = `<p class="search-empty-message">Start typing to search spots, neighborhoods, slang, and FAQs.</p>`;
    return;
  }

  const matches = searchIndex.filter((entry) =>
    entry.title.toLowerCase().includes(q) || entry.desc.toLowerCase().includes(q)
  ).slice(0, 20);

  if (matches.length === 0) {
    searchResultsEl.innerHTML = `<p class="search-empty-message">No matches for "${query}".</p>`;
    return;
  }

  searchResultsEl.innerHTML = matches.map((entry, i) => `
    <button type="button" class="search-result-item" data-index="${i}">
      <span class="search-result-title">${entry.title}</span>
      <span class="search-result-meta">${entry.meta}</span>
    </button>
  `).join('');

  searchResultsEl.querySelectorAll('.search-result-item').forEach((btn) => {
    btn.addEventListener('click', function() {
      const entry = matches[parseInt(this.getAttribute('data-index'), 10)];
      closeSearch();

      if (entry.type === 'venue') {
        resultsTitle.textContent = entry.item.title;
        currentPlanItems = [entry.item];
        itineraryContent.innerHTML = buildVenueCard(entry.item);
        resultsSection.classList.remove('hidden');
        resultsSection.scrollIntoView({ behavior: 'smooth' });
      } else if (entry.type === 'detail' && entry.element) {
        entry.element.setAttribute('open', '');
        entry.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  });
}

function openSearch() {
  if (searchIndex.length === 0) searchIndex = buildSearchIndex();
  searchModalOverlay.classList.remove('hidden');
  searchInput.value = '';
  renderSearchResults('');
  setTimeout(() => searchInput.focus(), 50);
}

function closeSearch() {
  searchModalOverlay.classList.add('hidden');
}

if (searchOpenBtn) searchOpenBtn.addEventListener('click', openSearch);
if (searchCloseBtn) searchCloseBtn.addEventListener('click', closeSearch);
if (searchModalOverlay) {
  searchModalOverlay.addEventListener('click', function(e) {
    if (e.target === searchModalOverlay) closeSearch();
  });
}
if (searchInput) {
  searchInput.addEventListener('input', function() {
    renderSearchResults(this.value);
  });
}

// "/" opens search, like most command-palette tools — but never while the
// person is already typing somewhere else on the page.
document.addEventListener('keydown', function(e) {
  const tag = (e.target.tagName || '').toLowerCase();
  const isTyping = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;

  if (e.key === '/' && !isTyping) {
    e.preventDefault();
    openSearch();
  } else if (e.key === 'Escape') {
    closeSearch();
    closeQuiz();
    if (checklistModalOverlay) checklistModalOverlay.classList.add('hidden');
  }
});


// --- WHAT TO BRING TODAY (derived from live weather + season) ---
const packingContent = document.getElementById('packing-content');

function buildPackingList(code, month) {
  const items = [];
  // SF is famously cold for its latitude, and evenings drop fast regardless of the daytime forecast
  items.push('A layer you can add in the evening — SF cools off fast after sunset, even in summer.');

  if (code === 45 || code === 48 || code === 3 || code === 2) {
    items.push('A light jacket or windbreaker — fog and wind are the real "weather" here more than temperature.');
  }
  if (code === 0 || code === 1) {
    items.push('Sunglasses and sunscreen — clear SF days can still have strong UV, especially near the water.');
  }
  if ([61, 63, 65, 51, 80, 95].includes(code)) {
    items.push('An umbrella or rain shell — real rain, not just fog, is in the forecast.');
  }
  if (month >= 5 && month <= 8) {
    items.push("It's peak fog season (roughly June–September) — pack warmer than the calendar suggests.");
  }
  items.push('Comfortable shoes — the hills are real, and a lot of the best spots are a walk apart.');

  return items;
}

function renderPackingList() {
  if (!packingContent) return;
  if (currentWeatherCode === null || currentWeatherCode === undefined) {
    packingContent.innerHTML = `<p class="no-events-message">Loading recommendations...</p>`;
    return;
  }
  const list = buildPackingList(currentWeatherCode, sfDayParts().month);
  packingContent.innerHTML = `<ul class="clue-list">${list.map((i) => `<li>${i}</li>`).join('')}</ul>`;
}

const packingInterval = setInterval(() => {
  if (currentWeatherCode !== null && currentWeatherCode !== undefined) {
    renderPackingList();
  }
}, 5000);
renderPackingList();


// --- OFFLINE SUPPORT (basic PWA caching) ---
// Caches the static shell so the site still loads (with live data features
// gracefully degrading) if a visitor opens it with no connection.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // Offline support just won't be available — the site still works fully online
    });
  });
}

// --- SPIN THE SF WHEEL ---
// One spin a day. The winning segment is deterministic (same for everyone,
// like the daily game and daily trivia) — the spin animation is just for
// delight, not suspense that could be "gamed" by refreshing.

const WHEEL_SEGMENTS = [
  { key: 'eat', label: 'Eat', emoji: '🍜' },
  { key: 'free', label: 'Free Thing', emoji: '💰' },
  { key: 'outdoor', label: 'Outdoor', emoji: '☀️' },
  { key: 'date', label: 'Date Idea', emoji: '❤️' },
  { key: 'gem', label: 'Hidden Gem', emoji: '⭐' },
  { key: 'neighborhood', label: 'Neighborhood', emoji: '🧭' },
  { key: 'sight', label: 'Sight', emoji: '🌉' },
  { key: 'trivia', label: 'Trivia', emoji: '📜' }
];

// Alternates the site's own brand colors — no new palette introduced
const WHEEL_COLORS = ['#10243E', '#C1440E', '#3B6EA5', '#F2A65A'];

const WHEEL_SPUN_KEY = 'sftoday-wheel-last-spun';

function wheelTodayStamp() {
  return sfDateStamp(); // San Francisco's actual calendar day — resets at real SF midnight
}

function hasSpunWheelToday() {
  try {
    return localStorage.getItem(WHEEL_SPUN_KEY) === wheelTodayStamp();
  } catch (error) {
    return false;
  }
}

function markWheelSpunToday() {
  try {
    localStorage.setItem(WHEEL_SPUN_KEY, wheelTodayStamp());
  } catch (error) {
    // localStorage unavailable — the wheel just won't remember across reloads
  }
}

function wheelPolarPoint(cx, cy, r, angleDeg) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function buildWheelSVG() {
  const svg = document.getElementById('sf-wheel');
  if (!svg) return null;

  const cx = 150, cy = 150, r = 145;
  const segAngle = 360 / WHEEL_SEGMENTS.length;
  const svgNS = 'http://www.w3.org/2000/svg';

  const group = document.createElementNS(svgNS, 'g');
  group.setAttribute('id', 'wheel-rotate-group');

  WHEEL_SEGMENTS.forEach((seg, i) => {
    const startAngle = i * segAngle;
    const endAngle = startAngle + segAngle;
    const p1 = wheelPolarPoint(cx, cy, r, startAngle);
    const p2 = wheelPolarPoint(cx, cy, r, endAngle);
    const largeArc = segAngle > 180 ? 1 : 0;

    const path = document.createElementNS(svgNS, 'path');
    const d = `M ${cx} ${cy} L ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} Z`;
    path.setAttribute('d', d);
    path.setAttribute('fill', WHEEL_COLORS[i % WHEEL_COLORS.length]);
    path.setAttribute('stroke', '#FBFAF8');
    path.setAttribute('stroke-width', '2');
    group.appendChild(path);

    const midAngle = startAngle + segAngle / 2;
    const labelPoint = wheelPolarPoint(cx, cy, r * 0.64, midAngle);
    const text = document.createElementNS(svgNS, 'text');
    text.setAttribute('x', labelPoint.x.toFixed(2));
    text.setAttribute('y', labelPoint.y.toFixed(2));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('font-size', '24');
    text.setAttribute('fill', '#FBFAF8');
    text.textContent = seg.emoji;
    group.appendChild(text);
  });

  svg.appendChild(group);
  return group;
}

function getWheelWinningIndex() {
  return sfDayOfYear() % WHEEL_SEGMENTS.length;
}

function pickWheelItem(segmentKey) {
  const dayIndex = sfDayOfYear();
  let list;
  switch (segmentKey) {
    case 'eat': list = evergreenCategories.dinner; break;
    case 'free': list = evergreenCategories.free; break;
    case 'outdoor': list = evergreenCategories.outdoors; break;
    case 'date': list = evergreenCategories.dating; break;
    case 'sight': list = evergreenCategories.visit; break;
    case 'gem': list = localFavorites; break;
    case 'neighborhood': {
      const keys = Object.keys(neighborhoods);
      const key = keys[dayIndex % keys.length];
      list = neighborhoods[key];
      break;
    }
    default: return null;
  }
  return list && list.length ? list[dayIndex % list.length] : null;
}

function renderWheelResult(segment) {
  const resultEl = document.getElementById('wheel-result');
  if (!resultEl) return;

  let shareText;

  if (segment.key === 'trivia' && typeof triviaFacts !== 'undefined') {
    const fact = triviaFacts[sfDayOfYear() % triviaFacts.length];
    shareText = `Today's SF Today wheel landed on Trivia: ${fact}`;
    resultEl.innerHTML = `
      <p class="wheel-landed-label">${segment.emoji} Landed on: <strong>${segment.label}</strong></p>
      <div class="plan-item">
        <h3>Today's SF Trivia</h3>
        <p>💡 ${fact}</p>
      </div>
      <button type="button" id="wheel-share-btn" class="secondary-btn">Share This Pick</button>
    `;
  } else {
    const item = pickWheelItem(segment.key);
    if (!item) {
      resultEl.innerHTML = `<p class="no-events-message">Couldn't pull today's pick — try refreshing.</p>`;
      return;
    }
    currentPlanItems = [item];
    shareText = `The SF Today wheel landed on ${segment.label} — ${item.title}${item.address ? ' at ' + item.address : ''}!`;
    resultEl.innerHTML = `
      <p class="wheel-landed-label">${segment.emoji} Landed on: <strong>${segment.label}</strong></p>
      ${buildVenueCard(item)}
      <button type="button" id="wheel-share-btn" class="secondary-btn">Share This Pick</button>
    `;
  }

  resultEl.classList.remove('hidden');

  const wheelShareBtn = document.getElementById('wheel-share-btn');
  if (wheelShareBtn) {
    wheelShareBtn.addEventListener('click', function() {
      if (navigator.share) {
        navigator.share({ text: shareText }).catch(() => {});
        return;
      }
      navigator.clipboard.writeText(shareText).then(() => {
        wheelShareBtn.textContent = 'Copied!';
        setTimeout(() => { wheelShareBtn.textContent = 'Share This Pick'; }, 1500);
      }).catch(() => {});
    });
  }
}

function wheelRestingRotation(centerAngle) {
  return 360 - centerAngle;
}

(function initWheel() {
  const wheelGroup = buildWheelSVG();
  const spinBtn = document.getElementById('wheel-spin-btn');
  const statusEl = document.getElementById('wheel-status');
  if (!wheelGroup || !spinBtn || !statusEl) return;

  const winningIndex = getWheelWinningIndex();
  const segAngle = 360 / WHEEL_SEGMENTS.length;
  const centerAngle = winningIndex * segAngle + segAngle / 2;
  const winningSegment = WHEEL_SEGMENTS[winningIndex];

  if (hasSpunWheelToday()) {
    wheelGroup.style.transition = 'none';
    wheelGroup.style.transform = `rotate(${wheelRestingRotation(centerAngle)}deg)`;
    renderWheelResult(winningSegment);
    statusEl.textContent = "You've already spun today — come back tomorrow for a new one!";
    spinBtn.disabled = true;
    spinBtn.textContent = 'Come Back Tomorrow';
    return;
  }

  spinBtn.addEventListener('click', function() {
    spinBtn.disabled = true;
    statusEl.textContent = 'Spinning...';

    const jitter = (Math.random() * 20) - 10; // small wobble, stays inside the slice
    const extraSpins = 5 + Math.floor(Math.random() * 3); // 5-7 full turns for drama
    const targetRotation = extraSpins * 360 + wheelRestingRotation(centerAngle) + jitter;

    wheelGroup.style.transition = 'transform 3.4s cubic-bezier(0.12, 0.67, 0.15, 1)';
    // Force a reflow so the browser registers the starting transform before animating
    wheelGroup.getBoundingClientRect();
    wheelGroup.style.transform = `rotate(${targetRotation}deg)`;

    setTimeout(() => {
      markWheelSpunToday();
      renderWheelResult(winningSegment);
      if (typeof launchConfetti === 'function') launchConfetti();
      statusEl.textContent = "That's today's spin — come back tomorrow for a new one!";
      spinBtn.textContent = 'Come Back Tomorrow';
    }, 3500);
  });
})();
