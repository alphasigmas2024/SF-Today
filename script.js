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

function walkingDirectionsLink(fromAddress, toAddress) {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(fromAddress)}&destination=${encodeURIComponent(toAddress)}&travelmode=walking`;
}

// Builds a full itinerary's HTML, inserting a real "get directions to next
// stop" link between consecutive addressed venues. Uses Google Maps' actual
// routing (not a guessed time) so the walk/transit estimate is always correct.
function buildItineraryHtml(items) {
  let html = '';
  items.forEach((item, i) => {
    html += buildVenueCard(item);
    const next = items[i + 1];
    if (next && item.address && next.address && item.address !== 'Citywide' && next.address !== 'Citywide') {
      html += `
        <div class="itinerary-connector">
          <a href="${walkingDirectionsLink(item.address, next.address)}" target="_blank" rel="noopener">
            🚶 Directions to next stop: ${next.title} →
          </a>
        </div>
      `;
    }
  });
  return html;
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

// Single, honest "last reviewed" date applied uniformly across the whole
// guide — not a fabricated per-venue date nobody actually checked individually.
const CONTENT_LAST_REVIEWED = "September 2026";

function reportIssueLink(title) {
  return `<a class="report-issue-link" href="feedback.html?venue=${encodeURIComponent(title)}" target="_blank" rel="noopener">⚠️ Report an issue</a>`;
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
      <div class="venue-footer-row">
        ${isRealVisitablePlace(item) ? visitedToggleHtml(item.title) : ''}
        <span class="venue-verified" title="This guide's information is periodically reviewed, not individually fact-checked per venue">✓ Checked ${CONTENT_LAST_REVIEWED}</span>
        ${reportIssueLink(item.title)}
      </div>
    </div>
  `;
}


// --- 3. PERMANENT / EVERGREEN CONTENT DATABASE ---
const evergreenCategories = {
  dinner: [
    { title: "El Farolito", desc: "World-famous, consistently great Mission-style burritos.", address: "2779 Mission St, San Francisco, CA", hours: "Open late — check current hours", tag: "local" },
    { title: "La Taqueria", desc: "A Mission classic, often ranked one of the best burritos in the city.", address: "2889 Mission St, San Francisco, CA", hours: "Check current hours", tag: "local" },
    { title: "Good Mong Kok Bakery", desc: "Cheap, incredibly delicious pork buns to-go in Chinatown.", address: "1039 Stockton St, San Francisco, CA", hours: "Morning to early afternoon — check current hours", tag: "local" },
    { title: "Tadich Grill", desc: "California's oldest continuously operating restaurant (since 1849) — classic seafood and a bar so long you can barely see the end.", address: "240 California St, San Francisco, CA", hours: "Lunch and dinner, closed Sundays — check current hours", tag: "touristy" },
    { title: "House of Prime Rib", desc: "A Nob Hill institution since 1949 — prime rib carved tableside from stainless steel carts, essentially unchanged in decades.", address: "1906 Van Ness Ave, San Francisco, CA", hours: "Dinner only — check current hours", tag: "touristy" },
    { title: "Tosca Cafe", desc: "A North Beach bar and restaurant since 1919, famous for its bourbon-and-chocolate 'house cappuccino' and Prohibition-era atmosphere.", address: "242 Columbus Ave, San Francisco, CA", hours: "Evenings, closed Mondays — check current hours", tag: "local" }
  ],
  family: [
    { title: "Exploratorium", desc: "Hands-on science museum on Pier 15 that kids and adults both love.", address: "Pier 15, San Francisco, CA", hours: "Check current hours", tag: "touristy" },
    { title: "California Academy of Sciences", desc: "Aquarium, planetarium, and a 4-story rainforest inside Golden Gate Park.", address: "55 Music Concourse Dr, San Francisco, CA", hours: "Check current hours", tag: "touristy" },
    { title: "Golden Gate Park Carousel", desc: "Historic 1914 carousel with hand-carved animals next to the playground.", address: "320 Bowling Green Dr, San Francisco, CA", hours: "Check current hours", tag: "local" },
    { title: "Aquarium of the Bay", desc: "Walk through underwater tunnels surrounded by sharks and rays, right on Pier 39.", address: "Pier 39, San Francisco, CA", hours: "Check current hours", tag: "touristy" },
    { title: "San Francisco Zoo", desc: "A full-size zoo on the city's western edge, right by Ocean Beach.", address: "Sloat Blvd & Great Highway, San Francisco, CA", hours: "Check current hours", tag: "local" },
    { title: "Musée Mécanique", desc: "A free-to-enter, coin-operated arcade museum with century-old mechanical games at Fisherman's Wharf.", address: "Pier 45, Shed A, San Francisco, CA", hours: "Check current hours", tag: "touristy" }
  ],
  free: [
    { title: "Palace of Fine Arts", desc: "Stunning Greco-Roman rotunda and peaceful lagoon.", address: "3601 Lyon St, San Francisco, CA", hours: "Open 24/7 (grounds)", tag: "touristy" },
    { title: "Golden Gate Bridge Walk", desc: "Walk or bike across the iconic orange span, completely free.", address: "Golden Gate Bridge Welcome Center, San Francisco, CA", hours: "Open 24/7 (pedestrian access varies by season)", tag: "touristy" },
    { title: "Cable Car Museum", desc: "See the powerhouse and museum where the historic cable cars operate.", address: "1201 Mason St, San Francisco, CA", hours: "Check current hours", tag: "local" },
    { title: "Baker Beach", desc: "A mile-long beach with one of the best straight-on views of the Golden Gate Bridge, especially at sunset.", address: "Baker Beach, San Francisco, CA", hours: "Open 24/7", tag: "local" },
    { title: "Pier 39 Sea Lions", desc: "Watch dozens of wild sea lions lounge and bark on the docks — they showed up uninvited after the 1989 earthquake and never left.", address: "Pier 39, San Francisco, CA", hours: "Open 24/7 to view, best in daylight", tag: "touristy" },
    { title: "Buena Vista Park", desc: "San Francisco's oldest official park — a steep, wooded hillside with better skyline views than most tourist spots, and a fraction of the crowds.", address: "Buena Vista Ave, San Francisco, CA", hours: "Open 24/7", tag: "local" },
    { title: "City Lights Bookstore", desc: "The legendary Beat Generation bookstore, still independent, still free to browse for hours.", address: "261 Columbus Ave, San Francisco, CA", hours: "Check current hours", tag: "local" },
    { title: "Golden Gate Fortune Cookie Factory", desc: "A tiny, working fortune cookie factory in Chinatown — watch them get folded by hand and try a free sample.", address: "56 Ross Alley, San Francisco, CA", hours: "Check current hours", tag: "local" },
    { title: "Golden Gate Park Bison Paddock", desc: "A real herd of American bison has lived in Golden Gate Park since the 1890s — free to visit, no zoo ticket required.", address: "Golden Gate Park Bison Paddock, San Francisco, CA", hours: "Open 24/7 (viewing hours vary by daylight)", tag: "local" }
  ],
  visit: [
    { title: "Alcatraz Island", desc: "The legendary former federal prison — book ferry tickets in advance.", address: "Pier 33, San Francisco, CA", hours: "Ferry departure times vary — check current schedule", tag: "touristy" },
    { title: "Twin Peaks", desc: "Sweeping 360° views from the geographic center of SF.", address: "Twin Peaks Blvd, San Francisco, CA", hours: "Open 24/7", tag: "touristy" },
    { title: "Lombard Street", desc: "The famous 'crookedest street in the world,' lined with hydrangeas.", address: "Lombard St & Hyde St, San Francisco, CA", hours: "Open 24/7", tag: "touristy" },
    { title: "Golden Gate Park", desc: "Over 1,000 acres of gardens, trails, lakes, and museums — bigger than Central Park, and free to wander.", address: "Golden Gate Park, San Francisco, CA", hours: "Open 24/7 (attraction hours vary)", tag: "touristy" },
    { title: "Walt Disney Family Museum", desc: "A museum in the Presidio dedicated to Walt Disney's life and work, told through his family's own archives.", address: "104 Montgomery St, San Francisco, CA", hours: "Check current hours", tag: "touristy" },
    { title: "Ferry Building", desc: "A restored 1898 transit hub turned gourmet marketplace, with its clock tower visible from across downtown.", address: "1 Ferry Building, San Francisco, CA", hours: "Check current hours", tag: "touristy" },
    { title: "Legion of Honor", desc: "A fine arts museum in a Beaux-Arts building on a clifftop, with a permanent Rodin collection and sweeping ocean views.", address: "100 34th Ave, San Francisco, CA", hours: "Check current hours", tag: "touristy" }
  ],
  outdoors: [
    { title: "Lands End Trail", desc: "Coastal hike with cypress trees, ocean views, and a hidden stone labyrinth.", address: "Lands End Trailhead, El Camino Del Mar, San Francisco, CA", hours: "Open 24/7", tag: "local" },
    { title: "Dolores Park", desc: "The ultimate Mission gathering spot for sunbathing and skyline views.", address: "Dolores St & 19th St, San Francisco, CA", hours: "6am – 10pm", tag: "local" },
    { title: "Crissy Field", desc: "Flat, scenic waterfront path from Fort Point to the Marina Green.", address: "1199 East Beach, San Francisco, CA", hours: "Open 24/7", tag: "local" },
    { title: "San Francisco Botanical Garden", desc: "Over 9,000 plant species from around the world, including a genuinely peaceful redwood grove, inside Golden Gate Park.", address: "1199 9th Ave, San Francisco, CA", hours: "Check current hours", tag: "local" },
    { title: "Japanese Tea Garden", desc: "The oldest public Japanese garden in the US, with koi ponds, a pagoda, and a teahouse, inside Golden Gate Park.", address: "75 Hagiwara Tea Garden Dr, San Francisco, CA", hours: "Check current hours", tag: "touristy" },
    { title: "Stow Lake", desc: "Rent a rowboat or just walk the loop around this artificial lake with a waterfall and a small island, inside Golden Gate Park.", address: "Stow Lake Dr, San Francisco, CA", hours: "Open 24/7 (boat rentals have set hours)", tag: "local" },
    { title: "Presidio Tunnel Tops", desc: "A newer park with wide lawns, overlooks, and trails on top of a former highway tunnel, with Golden Gate Bridge views.", address: "Presidio Tunnel Tops, San Francisco, CA", hours: "Open 24/7", tag: "local" },
    { title: "Conservatory of Flowers", desc: "A fairytale-like Victorian glasshouse in Golden Gate Park, filled with rare tropical plants.", address: "100 John F Kennedy Dr, San Francisco, CA", hours: "Check current hours", tag: "touristy" },
    { title: "Marshall's Beach", desc: "A secluded beach with one of the best close-up views of the Golden Gate Bridge, reached by a short, steep trail.", address: "Marshall's Beach Trail, San Francisco, CA", hours: "Open 24/7", tag: "local" },
    { title: "Angel Island State Park", desc: "A short ferry ride from the city, with hiking and biking trails circling the whole island and sweeping bay views.", address: "Angel Island State Park, San Francisco Bay, CA", hours: "Reachable by ferry — check current schedule", tag: "local" }
  ],
  history: [
    { title: "Angel Island Immigration Station", desc: "From 1910 to 1940, this was the West Coast's main immigration processing site — but unlike Ellis Island's hours-long process, Chinese immigrants detained here under the Chinese Exclusion Act of 1882 were often held for weeks, months, or occasionally years while their right to enter the country was interrogated. Poems carved into the barracks walls by detainees are still visible today.", address: "Angel Island Immigration Station, Angel Island State Park, San Francisco Bay, CA", hours: "Reachable by ferry from SF — check current ferry and museum hours", tag: "local" },
    { title: "The Fillmore District (\"Harlem of the West\")", desc: "By the 1940s, the Fillmore was the center of San Francisco's Black community and West Coast jazz scene, home to over 180 Black-owned businesses. Starting in the 1960s, the city's Redevelopment Agency demolished much of the neighborhood under \"urban renewal,\" displacing tens of thousands of Black residents — many of whom were promised the right to return but never could. Large parts of the neighborhood sat vacant for decades afterward.", address: "Fillmore St & Geary Blvd, San Francisco, CA", hours: "Open 24/7 — a handful of jazz clubs and historic markers remain", tag: "local" },
    { title: "Japantown & the Wartime Incarceration", desc: "San Francisco's Japantown was one of the largest Japanese American communities on the West Coast until February 1942, when Executive Order 9066 forced the removal and incarceration of Japanese Americans — regardless of citizenship — in inland camps for the rest of World War II. Many families permanently lost homes and businesses; the emptied neighborhood was resettled by other communities, including the Fillmore's growing Black population, while its Japanese American residents remained imprisoned.", address: "Japantown, Post St & Buchanan St, San Francisco, CA", hours: "Open 24/7", tag: "local" }
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
    { title: "Fillmore Street", desc: "A boutique-lined shopping corridor running through Pacific Heights.", address: "Fillmore St & Sacramento St, San Francisco, CA", hours: "Shops vary — generally 10am–7pm", tag: "local" },
    { title: "Fort Mason Center", desc: "A former Army post turned arts and culture campus, with galleries, a theater, and bay views.", address: "Fort Mason, San Francisco, CA", hours: "Grounds open 24/7 — venue hours vary", tag: "local" }
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
    { title: "Alamo Square", desc: "Home to the 'Painted Ladies' — the postcard row of Victorian houses with the skyline behind them.", address: "Alamo Square, Steiner St & Hayes St, San Francisco, CA", hours: "Open 24/7", tag: "touristy" },
    { title: "The Panhandle", desc: "A narrow strip of park connecting the Haight to Golden Gate Park proper — locals walk dogs, jog, and hang out here.", address: "The Panhandle, San Francisco, CA", hours: "Open 24/7", tag: "local" }
  ],
  soma: [
    { title: "Oracle Park", desc: "The Giants' waterfront ballpark, with one of the best views in baseball from McCovey Cove.", address: "24 Willie Mays Plaza, San Francisco, CA", hours: "Game days — check current schedule", tag: "local" },
    { title: "Chase Center", desc: "The Warriors' home arena in Mission Bay, hosting games and major concerts.", address: "1 Warriors Way, San Francisco, CA", hours: "Event days — check current schedule", tag: "local" },
    { title: "Yerba Buena Gardens", desc: "A green rooftop park above the Moscone Center, with a waterfall memorial to Martin Luther King Jr. and a carousel.", address: "750 Howard St, San Francisco, CA", hours: "Open 24/7", tag: "local" }
  ],
  westportal: [
    { title: "West Portal Avenue", desc: "A small-town-feel shopping strip where the Muni Metro tunnel surfaces above ground.", address: "West Portal Ave, San Francisco, CA", hours: "Shops vary", tag: "local" },
    { title: "Lake Merced", desc: "A calm lake loop popular for walking, running, and rowing in the city's southwest corner.", address: "Lake Merced Blvd, San Francisco, CA", hours: "Open 24/7", tag: "local" }
  ],
  bayview: [
    { title: "Bayview Opera House", desc: "A historic community arts venue and one of the oldest theaters in the city.", address: "4705 3rd St, San Francisco, CA", hours: "Check current hours", tag: "local" },
    { title: "Candlestick Point", desc: "A waterfront state recreation area with fishing, picnic spots, and bay views.", address: "Carroll Ave, San Francisco, CA", hours: "Open 24/7", tag: "local" },
    { title: "Heron's Head Park", desc: "A quiet, little-visited waterfront park built on a former shipping pier — one of the city's best spots for birdwatching.", address: "Heron's Head Park, San Francisco, CA", hours: "Open 24/7", tag: "local" }
  ],
  castronoe: [
    { title: "Castro Theatre", desc: "A restored 1922 movie palace and the beating heart of the Castro's community and culture.", address: "429 Castro St, San Francisco, CA", hours: "Check current hours", tag: "local" },
    { title: "24th Street, Noe Valley", desc: "A quiet, stroller-friendly shopping strip with cafes, boutiques, and a real small-town feel.", address: "24th St & Castro St, San Francisco, CA", hours: "Shops vary", tag: "local" },
    { title: "GLBT Historical Society Museum", desc: "A small museum dedicated to LGBTQ+ history, a block from the Castro's famous intersection.", address: "4127 18th St, San Francisco, CA", hours: "Check current hours", tag: "local" }
  ],
  excelsior: [
    { title: "McLaren Park", desc: "One of SF's largest parks, with trails, a lake, and an amphitheater — far quieter than Golden Gate Park.", address: "50 John F Shelley Dr, San Francisco, CA", hours: "Open 24/7", tag: "local" },
    { title: "Mission Street, Excelsior", desc: "A lively, diverse commercial corridor with some of the city's best under-the-radar food.", address: "Mission St & Excelsior Ave, San Francisco, CA", hours: "Shops vary", tag: "local" }
  ],
  missionbernal: [
    { title: "Clarion Alley Mural Project", desc: "A full alley of ever-changing, politically charged street murals by local artists.", address: "Clarion Alley, San Francisco, CA", hours: "Open 24/7", tag: "local" },
    { title: "Bernal Heights Park", desc: "Locals just call it 'Bernal Hill' — an off-leash dog hill with 360° views and way fewer crowds than Twin Peaks.", address: "Bernal Heights Blvd, San Francisco, CA", hours: "Open 24/7", tag: "local" },
    { title: "Balmy Alley", desc: "The Mission's original mural alley, painted and repainted since the 1970s — Clarion Alley's older, quieter sibling.", address: "Balmy Alley, San Francisco, CA", hours: "Open 24/7", tag: "local" }
  ]
};


// --- 5. FILTER PLANNER DATABASE ---
// vibe: "outdoor" | "indoor" | "either" (works for either filter state)
// dogFriendly: true if this is a reasonable spot to bring a dog
const activities = [
  { title: "Dim Sum & Shopping in Chinatown", desc: "Grab cheap pork buns and browse the shops on Grant Ave.", personas: ["teen", "tourist", "parent", "local"], budget: "mid", time: "short", address: "Grant Ave, San Francisco, CA", hours: "Shops vary — generally 10am–7pm", vibe: "indoor", dogFriendly: false, tag: "local" },
  { title: "Golden Gate Park Mega-Day", desc: "Rent a boat at Stow Lake, visit the Academy of Sciences, and see the Bison.", personas: ["parent", "tourist"], budget: "high", time: "long", address: "Golden Gate Park, San Francisco, CA", hours: "Park open 24/7 — attraction hours vary", vibe: "outdoor", dogFriendly: false, tag: "touristy" },
  { title: "Sunset at Dolores Park", desc: "Bring a blanket, grab ice cream, and watch the sunset over the city skyline.", personas: ["teen", "local"], budget: "low", time: "short", address: "Dolores St & 19th St, San Francisco, CA", hours: "6am – 10pm", vibe: "outdoor", dogFriendly: true, tag: "local" },
  { title: "Free Museum Day & Ferry Building", desc: "Check out public art spaces, then take Muni to the Ferry Building.", personas: ["tourist", "parent"], budget: "free", time: "long", address: "1 Ferry Building, San Francisco, CA", hours: "Check current hours", vibe: "indoor", dogFriendly: false, tag: "touristy" },
  { title: "Dinner & A Concert Night Out", desc: "Great local dining followed by live music at an intimate venue.", personas: ["local"], budget: "splurge", time: "long", address: "Hayes Valley, San Francisco, CA", hours: "Evenings — check specific venue", vibe: "indoor", dogFriendly: false, tag: "local" },
  { title: "Hike to the Labyrinth", desc: "Hike the Lands End trail to the secret rock labyrinth. Amazing bridge views.", personas: ["teen", "local"], budget: "free", time: "short", address: "Lands End Trailhead, El Camino Del Mar, San Francisco, CA", hours: "Open 24/7", vibe: "outdoor", dogFriendly: true, tag: "local" },
  { title: "Crissy Field Bike & Beach Walk", desc: "Flat, scenic waterfront path with Golden Gate Bridge views the whole way.", personas: ["parent", "local", "tourist"], budget: "free", time: "short", address: "1199 East Beach, San Francisco, CA", hours: "Open 24/7", vibe: "outdoor", dogFriendly: true, tag: "local" },
  { title: "Dog Walk & Coffee at Duboce Park", desc: "A small, friendly neighborhood dog park with a coffee shop right across the street.", personas: ["local"], budget: "low", time: "short", address: "Duboce Park, San Francisco, CA", hours: "Open 24/7", vibe: "outdoor", dogFriendly: true, tag: "local" },
  { title: "Rainy Day Arcade at Musée Mécanique", desc: "Vintage mechanical arcade games at Fisherman's Wharf — a fun, cheap indoor escape.", personas: ["teen", "tourist"], budget: "low", time: "short", address: "Pier 45, Shed A, San Francisco, CA", hours: "Check current hours", vibe: "indoor", dogFriendly: false, tag: "touristy" },
  { title: "Bernal Hill Sunset Hike", desc: "An off-leash dog hill with 360° views and way fewer crowds than Twin Peaks.", personas: ["local", "teen"], budget: "free", time: "short", address: "Bernal Heights Blvd, San Francisco, CA", hours: "Open 24/7", vibe: "outdoor", dogFriendly: true, tag: "local" },
  { title: "Fancy Tasting Menu Night", desc: "A splurge-worthy multi-course dinner — book ahead for weekend slots.", personas: ["local"], budget: "splurge", time: "long", address: "Hayes Valley, San Francisco, CA", hours: "Evenings — check specific restaurant", vibe: "indoor", dogFriendly: false, tag: "local" },
  { title: "Exploratorium Rainy Day", desc: "Hands-on science museum on Pier 15 — a great full-day indoor plan when the fog rolls in.", personas: ["parent", "teen", "tourist"], budget: "high", time: "long", address: "Pier 15, San Francisco, CA", hours: "Check current hours", vibe: "indoor", dogFriendly: false, tag: "touristy" },
  { title: "Cable Car Hop & Chinatown Walk", desc: "Ride a historic cable car, then wander Chinatown's alleys and shops.", personas: ["tourist", "teen"], budget: "mid", time: "short", address: "Powell St Cable Car Turnaround, San Francisco, CA", hours: "Check current hours", vibe: "outdoor", dogFriendly: false, tag: "touristy" },
  { title: "Local's Day Off: Ocean Beach & Thrift Shopping", desc: "A windswept beach walk followed by browsing Outer Sunset's thrift and vintage shops.", personas: ["local"], budget: "free", time: "long", address: "Great Highway, San Francisco, CA", hours: "Open 24/7", vibe: "outdoor", dogFriendly: true, tag: "local" },
  { title: "Family Picnic at Marina Green", desc: "Wide waterfront lawn with kite-flying, joggers, and Golden Gate Bridge views.", personas: ["parent", "local"], budget: "free", time: "short", address: "Marina Green Dr, San Francisco, CA", hours: "Open 24/7", vibe: "outdoor", dogFriendly: true, tag: "local" },
  { title: "Rainy Day Bookstore Crawl", desc: "Hop between a few of the city's best independent bookstores, coffee in hand.", personas: ["local", "teen"], budget: "free", time: "short", address: "Clement St, San Francisco, CA", hours: "Shops vary", vibe: "indoor", dogFriendly: false, tag: "local" },
  { title: "Big Night Out: SOMA Bar Hop", desc: "A proper night out across a few of SOMA's best bars and lounges.", personas: ["local"], budget: "high", time: "long", address: "SOMA, San Francisco, CA", hours: "Evenings — check specific venues", vibe: "indoor", dogFriendly: false, tag: "local" },
  { title: "Twin Peaks Sunset Walk", desc: "Sweeping 360° views from the geographic center of the city — best at golden hour.", personas: ["tourist", "local"], budget: "free", time: "short", address: "Twin Peaks Blvd, San Francisco, CA", hours: "Open 24/7", vibe: "outdoor", dogFriendly: true, tag: "touristy" },
  { title: "Teen Free Day: Golden Gate Park Exploration", desc: "A full day wandering Golden Gate Park's trails, lakes, and gardens — no tickets required for any of it.", personas: ["teen"], budget: "free", time: "long", address: "Golden Gate Park, San Francisco, CA", hours: "Open 24/7", vibe: "outdoor", dogFriendly: true, tag: "local" },
  { title: "Teen Budget Day: Chinatown to North Beach Crawl", desc: "Cheap eats, alleyway exploring, and people-watching across two of the city's most walkable neighborhoods.", personas: ["teen"], budget: "low", time: "long", address: "Grant Ave, San Francisco, CA", hours: "Shops vary — generally 10am–7pm", vibe: "outdoor", dogFriendly: false, tag: "local" },
  { title: "Teen Day: Aquarium & Arcade at the Wharf", desc: "A full day at Fisherman's Wharf — underwater tunnels, vintage arcade games, and boardwalk food.", personas: ["teen"], budget: "mid", time: "long", address: "Pier 39, San Francisco, CA", hours: "Check current hours", vibe: "indoor", dogFriendly: false, tag: "touristy" },
  { title: "Teen Splurge Day: Alcatraz & Shopping", personas: ["teen", "tourist"], desc: "The full Alcatraz experience in the morning, then an afternoon of shopping and a nice dinner.", budget: "high", time: "long", address: "Pier 33, San Francisco, CA", hours: "Ferry departure times vary — check current schedule", vibe: "outdoor", dogFriendly: false, tag: "touristy" },
  { title: "Parent Free Day: Parks & Playgrounds", desc: "A relaxed, zero-cost day moving between playgrounds, open lawns, and shaded paths — built for a full day with kids in tow.", personas: ["parent"], budget: "free", time: "long", address: "Golden Gate Park, San Francisco, CA", hours: "Open 24/7", vibe: "outdoor", dogFriendly: true, tag: "local" },
  { title: "Parent Budget Day: Zoo & Ocean Beach", desc: "A full day combining the zoo with a windswept walk on Ocean Beach right next door.", personas: ["parent"], budget: "low", time: "long", address: "Sloat Blvd & Great Highway, San Francisco, CA", hours: "Check current hours", vibe: "outdoor", dogFriendly: false, tag: "local" },
  { title: "Parent Day: Academy of Sciences & Tea Garden", desc: "A full science-and-nature day inside Golden Gate Park — aquarium, planetarium, rainforest dome, and a calm stroll through the Japanese Tea Garden after.", personas: ["parent"], budget: "mid", time: "long", address: "55 Music Concourse Dr, San Francisco, CA", hours: "Check current hours", vibe: "indoor", dogFriendly: false, tag: "touristy" },
  { title: "Family Splurge Day: Bay Cruise & Dinner", desc: "A guided bay cruise in the afternoon followed by a proper sit-down dinner to close out the day.", personas: ["parent"], budget: "splurge", time: "long", address: "Pier 39, San Francisco, CA", hours: "Check current tour and dinner reservation times", vibe: "indoor", dogFriendly: false, tag: "touristy" },
  { title: "Tourist Budget Day: Cable Cars & Ferry Building", desc: "Ride the cable cars across downtown, then spend the afternoon browsing the Ferry Building's food hall and farmers market.", personas: ["tourist"], budget: "low", time: "long", address: "Powell St Cable Car Turnaround, San Francisco, CA", hours: "Check current hours", vibe: "outdoor", dogFriendly: false, tag: "touristy" },
  { title: "Tourist Day: Alcatraz & Chinatown", desc: "Morning ferry to Alcatraz, afternoon exploring Chinatown's alleys, temples, and bakeries.", personas: ["tourist"], budget: "mid", time: "long", address: "Pier 33, San Francisco, CA", hours: "Ferry departure times vary — check current schedule", vibe: "outdoor", dogFriendly: false, tag: "touristy" },
  { title: "Tourist Free Day: Golden Gate Bridge & Crissy Field", desc: "Walk the bridge, then follow the flat waterfront path along Crissy Field for the rest of the day — genuinely free start to finish.", personas: ["tourist", "local"], budget: "free", time: "long", address: "Golden Gate Bridge Welcome Center, San Francisco, CA", hours: "Open 24/7 (pedestrian access varies by season)", vibe: "outdoor", dogFriendly: true, tag: "touristy" },
  { title: "Tourist Splurge Day: Private Tour & Fine Dining", desc: "A guided private tour of the city's highlights by day, capped with a high-end dinner reservation.", personas: ["tourist"], budget: "splurge", time: "long", address: "Hayes Valley, San Francisco, CA", hours: "Check current tour and reservation times", vibe: "indoor", dogFriendly: false, tag: "touristy" },
  { title: "Local Day: Neighborhood Food Crawl", desc: "A full day working through a handful of the Richmond's best under-the-radar restaurants and bakeries, on foot.", personas: ["local"], budget: "mid", time: "long", address: "Clement St, San Francisco, CA", hours: "Shops vary", vibe: "indoor", dogFriendly: false, tag: "local" },
  { title: "Local Free Day: Lands End to Sutro Full Loop", desc: "The full coastal loop from the Lands End trailhead past the labyrinth to the Sutro Baths ruins and back — a real half-day-plus hike, completely free.", personas: ["local", "teen"], budget: "free", time: "long", address: "Lands End Trailhead, El Camino Del Mar, San Francisco, CA", hours: "Open 24/7", vibe: "outdoor", dogFriendly: true, tag: "local" },
  { title: "Teen Splurge Day: VIP Tour & Concert Night", desc: "A guided city highlights tour by day, then a proper night out at a live music venue.", personas: ["teen"], budget: "splurge", time: "long", address: "Hayes Valley, San Francisco, CA", hours: "Check current tour and venue schedules", vibe: "indoor", dogFriendly: false, tag: "touristy" },
  { title: "Local Day: Cable Car Hop & Museum Afternoon", desc: "A low-cost full day riding the cable cars between neighborhoods, capped with a Cable Car Museum visit.", personas: ["local"], budget: "low", time: "long", address: "1201 Mason St, San Francisco, CA", hours: "Check current hours", vibe: "outdoor", dogFriendly: false, tag: "local" },
  { title: "Teen Shopping Spree: Union Square", desc: "A few hours browsing the flagship stores and boutiques around Union Square.", personas: ["teen"], budget: "high", time: "short", address: "Union Square, San Francisco, CA", hours: "Shops vary — generally 10am–7pm", vibe: "indoor", dogFriendly: false, tag: "touristy" },
  { title: "Teen VIP Photo Tour", desc: "A guided couple of hours hitting the city's most photogenic viewpoints with a private guide.", personas: ["teen"], budget: "splurge", time: "short", address: "Twin Peaks Blvd, San Francisco, CA", hours: "Check current tour schedules", vibe: "outdoor", dogFriendly: false, tag: "touristy" },
  { title: "Parent Quick Escape: Coffee & Waterfront Walk", desc: "A short, easy outing — coffee to go, then a flat stroll along the Marina waterfront.", personas: ["parent"], budget: "low", time: "short", address: "Marina Green Dr, San Francisco, CA", hours: "Open 24/7", vibe: "outdoor", dogFriendly: true, tag: "local" },
  { title: "Parent Afternoon: Guided Museum Visit", personas: ["parent"], desc: "A few hours at a hands-on museum, worth it for a shorter but still substantial outing with kids.", budget: "high", time: "short", address: "Pier 15, San Francisco, CA", hours: "Check current hours", vibe: "indoor", dogFriendly: false, tag: "touristy" },
  { title: "Parent Splurge Afternoon: Spa & Lunch", desc: "A few hours to yourself — a spa treatment followed by a nice lunch nearby.", personas: ["parent"], budget: "splurge", time: "short", address: "Union Square, San Francisco, CA", hours: "Check current hours", vibe: "indoor", dogFriendly: false, tag: "local" },
  { title: "Tourist Afternoon: Guided Alcatraz Express", desc: "A shorter, guided version of the Alcatraz visit for travelers tight on time.", personas: ["tourist"], budget: "high", time: "short", address: "Pier 33, San Francisco, CA", hours: "Ferry departure times vary — check current schedule", vibe: "outdoor", dogFriendly: false, tag: "touristy" },
  { title: "Tourist Splurge Afternoon: Fine Dining at the Wharf", desc: "A few hours built around a high-end lunch with bay views at Fisherman's Wharf.", personas: ["tourist"], budget: "splurge", time: "short", address: "Pier 39, San Francisco, CA", hours: "Check current reservation times", vibe: "indoor", dogFriendly: false, tag: "touristy" },
  { title: "Local Afternoon: Rooftop Bar", desc: "A couple of hours at a SOMA rooftop spot for drinks and a skyline view.", personas: ["local"], budget: "high", time: "short", address: "SOMA, San Francisco, CA", hours: "Evenings — check current hours", vibe: "indoor", dogFriendly: false, tag: "local" },
  { title: "Local Splurge Afternoon: Tasting Flight", desc: "A short, indulgent stop for a curated tasting flight in Hayes Valley.", personas: ["local"], budget: "splurge", time: "short", address: "Hayes Valley, San Francisco, CA", hours: "Check current hours", vibe: "indoor", dogFriendly: false, tag: "local" }
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
    htmlString += buildItineraryHtml(matches);
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
      itineraryContent.innerHTML = buildItineraryHtml(evergreenCategories[categoryKey]);
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
      itineraryContent.innerHTML = buildItineraryHtml(neighborhoods[key]);
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
  const glanceWeatherEl = document.getElementById('glance-weather');
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
    weatherElement.classList.remove('skeleton-text');
    if (glanceWeatherEl) {
      glanceWeatherEl.textContent = `${condition} · ${temp}°F`;
      glanceWeatherEl.classList.remove('skeleton-text');
    }
  } catch (error) {
    weatherElement.textContent = "Weather unavailable right now.";
    weatherElement.classList.remove('skeleton-text');
    if (glanceWeatherEl) {
      glanceWeatherEl.textContent = "Unavailable";
      glanceWeatherEl.classList.remove('skeleton-text');
    }
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
    // DataSF migrated from data.sfgov.org to data.sf.gov in September 2026 —
    // using the new official domain so this doesn't break as the old one winds down.
    const url = `https://data.sf.gov/resource/yhqp-riqs.json?$where=${encodeURIComponent(whereClause)}&$limit=15`;
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
  },
  {
    acceptableAnswers: ["golden gate bridge"],
    clues: [
      "It's not actually the color its name suggests.",
      "The color was chosen partly because it shows up well in the fog.",
      "It opened in 1937, and was the longest suspension bridge in the world at the time.",
      "You can walk or bike across it for free, connecting the city to Marin County.",
      "It's painted 'International Orange' — a name almost as famous as the bridge itself."
    ]
  },
  {
    acceptableAnswers: ["alcatraz", "alcatraz island"],
    clues: [
      "No one has ever officially escaped and been proven to survive.",
      "Its name comes from a Spanish word for a type of seabird.",
      "It operated as a federal prison from 1934 to 1963, holding some of the country's most notorious inmates.",
      "You need to book a ferry ticket, ideally days in advance, to visit.",
      "Al Capone was one of its most famous residents."
    ]
  },
  {
    acceptableAnswers: ["painted ladies", "the painted ladies", "postcard row"],
    clues: [
      "You've probably seen them in the opening credits of a 90s sitcom.",
      "They're a row of Victorian houses, each painted in three or more contrasting colors.",
      "A city skyline rises dramatically behind them, which is why photographers love this spot.",
      "They face a square named after a fort that once guarded the bay.",
      "They sit across from Alamo Square Park."
    ]
  },
  {
    acceptableAnswers: ["coit tower"],
    clues: [
      "It was funded by a woman obsessed with firefighters after they saved her life as a child.",
      "Inside, it's covered in Depression-era murals painted by dozens of local artists.",
      "Some people think its shape resembles a fire hose nozzle, though that wasn't the intent.",
      "It sits atop Telegraph Hill, with sweeping views of the bay.",
      "Wild parrots are often seen — and heard — flying around it."
    ]
  },
  {
    acceptableAnswers: ["palace of fine arts"],
    clues: [
      "It was built for a world's fair and was never meant to be permanent.",
      "Its dome and columns are Greco-Roman in style, though it's less than 120 years old.",
      "It sits beside a peaceful lagoon that's popular with photographers and swans.",
      "It was fully rebuilt in the 1960s after the original, temporary structure began crumbling.",
      "It's in the Marina District, near Crissy Field."
    ]
  },
  {
    acceptableAnswers: ["ferry building", "the ferry building"],
    clues: [
      "Its clock tower survived a massive earthquake almost untouched.",
      "It used to serve 50,000 commuters a day before the bridges were built.",
      "Today it's better known for its farmers market and gourmet food hall than for actual ferries.",
      "It sits at the foot of Market Street, right on the Embarcadero.",
      "You can still catch a real ferry from right outside it."
    ]
  },
  {
    acceptableAnswers: ["ghirardelli square"],
    clues: [
      "A giant illuminated sign spelling out a brand name sits atop it, visible for miles.",
      "It used to be a chocolate and spice factory, not a shopping center.",
      "You can still get a sundae made on the premises.",
      "It's a short walk from Fisherman's Wharf, near the cable car turnaround.",
      "The chocolate brand it's named after still has a shop inside."
    ]
  },
  {
    acceptableAnswers: ["mission dolores", "mission san francisco de asis"],
    clues: [
      "It's the oldest surviving structure in San Francisco.",
      "It predates the city's founding — construction finished in 1791.",
      "It gave its name to the neighborhood, the park, and the street that all share its name.",
      "Its adjoining cemetery holds some of the earliest non-Native burials in the city.",
      "It sits just blocks from the park where locals gather for sunset."
    ]
  },
  {
    acceptableAnswers: ["twin peaks"],
    clues: [
      "Locals debate whether it's better at sunset or for the fog rolling in.",
      "It's the second-highest point in the city, and one of the windiest.",
      "There's no charge to drive or hike to the top.",
      "Its two summits give the spot its name.",
      "It sits at the geographic center of San Francisco, with 360° views."
    ]
  },
  {
    acceptableAnswers: ["16th avenue tiled steps", "tiled steps", "the tiled steps"],
    clues: [
      "It took two neighbors, over a thousand donated tiles, and about 15 years to finish.",
      "The design mimics a mosaic path rising from the ocean to the stars.",
      "It's a residential staircase, not an official city landmark or museum.",
      "It climbs a steep hill in the Sunset District, blocks from Golden Gate Park.",
      "It sits at 16th Avenue and Moraga Street."
    ]
  },
  {
    acceptableAnswers: ["japanese tea garden"],
    clues: [
      "It predates the park's zoo, museums, and most of its other attractions.",
      "It was built for an 1894 exposition and never removed.",
      "Its original caretaker family was forced to leave during WWII incarceration and never got it back.",
      "It's the oldest public Japanese garden in the country.",
      "It sits inside Golden Gate Park, complete with a koi pond and pagoda."
    ]
  },
  {
    acceptableAnswers: ["powell street cable car turnaround", "cable car turnaround"],
    clues: [
      "There's no engine here — it's entirely human-powered.",
      "Workers physically rotate the car on a turntable by hand at the end of the line.",
      "It's usually one of the most crowded single spots in the city for tourists.",
      "It sits where Powell Street meets Market Street.",
      "It's the southern terminus of two of the city's three remaining cable car lines."
    ]
  },
  {
    acceptableAnswers: ["musee mecanique"],
    clues: [
      "Admission is free, but bring quarters if you actually want to play anything.",
      "Its oldest machines date back over a century, including a mechanical fortune teller.",
      "It's one of the largest privately-owned collections of coin-operated machines in the world.",
      "It moved here after its original Cliff House location was affected by a fire.",
      "It sits at Pier 45, near Fisherman's Wharf."
    ]
  },
  {
    acceptableAnswers: ["grace cathedral"],
    clues: [
      "Its front doors are exact replicas of a set in Florence, Italy.",
      "You can walk a labyrinth on its floor, modeled after one in a French cathedral.",
      "It took over 50 years to fully complete, finishing in the 1960s.",
      "It hosts a famous yoga night with music, open to all faiths and none.",
      "It sits atop Nob Hill, one of the city's steepest and most storied hills."
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
  const glanceSunsetEl = document.getElementById('glance-sunset');

  if (diffMs <= 0) {
    sunsetContent.innerHTML = `<p>Today's sunset already happened at <strong>${formatSFTime(sunsetTime)}</strong>. Catch golden hour tomorrow instead!</p>`;
    if (glanceSunsetEl) {
      glanceSunsetEl.textContent = `${formatSFTime(sunsetTime)} (past)`;
      glanceSunsetEl.classList.remove('skeleton-text');
    }
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

  if (glanceSunsetEl) {
    glanceSunsetEl.textContent = `${formatSFTime(sunsetTime)} (${countdownText})`;
    glanceSunsetEl.classList.remove('skeleton-text');
  }
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

function fogShortLabel(percent) {
  if (percent >= 80) return "🌫️ Heavy";
  if (percent >= 45) return "☁️ Hazy";
  if (percent >= 20) return "⛅ Mild";
  return "☀️ Clear";
}

function renderFogMeter() {
  const glanceFogEl = document.getElementById('glance-fog');
  if (!fogMeterFill || !fogMeterStatus) return;
  if (currentWeatherCode === null || currentWeatherCode === undefined) {
    fogMeterStatus.textContent = 'Reading current conditions...';
    return;
  }
  const level = fogLevelForCode(currentWeatherCode);
  fogMeterFill.style.width = `${level.percent}%`;
  fogMeterStatus.textContent = level.label;
  if (glanceFogEl) {
    glanceFogEl.textContent = fogShortLabel(level.percent);
    glanceFogEl.classList.remove('skeleton-text');
  }
}

// currentWeatherCode is set asynchronously by script.js's updateWeather() — poll
// briefly until it's available, then keep the meter in sync going forward.
const fogMeterInterval = setInterval(() => {
  if (currentWeatherCode !== null && currentWeatherCode !== undefined) {
    renderFogMeter();
  }
}, 5000);
renderFogMeter();


// --- WEATHER-BASED GUIDE REORDERING ---
// Quietly reorders "Explore SF Guides" so weather-appropriate categories
// surface first — runs once per page load, not repeatedly, so cards don't
// keep shuffling under someone while they're browsing.
const GUIDE_WEATHER_AFFINITY = {
  outdoors: 'outdoor',
  free: 'outdoor',
  dinner: 'indoor',
  family: 'indoor',
  history: 'indoor',
  visit: 'neutral',
  transit: 'neutral',
  stories: 'neutral'
};

let guidesReordered = false;

function reorderGuidesForWeather() {
  if (guidesReordered) return;
  if (currentWeatherCode === null || currentWeatherCode === undefined) return;

  const grid = document.getElementById('guides-grid');
  const note = document.getElementById('guides-reorder-note');
  if (!grid) return;

  const goodOutdoor = isGoodOutdoorWeather(currentWeatherCode);
  const cards = Array.from(grid.children);
  const scored = cards.map((card) => {
    const key = card.getAttribute('data-category');
    const affinity = GUIDE_WEATHER_AFFINITY[key] || 'neutral';
    let score = 1; // neutral stays in the middle
    if (affinity === 'outdoor') score = goodOutdoor ? 0 : 2;
    if (affinity === 'indoor') score = goodOutdoor ? 2 : 0;
    return { card, score };
  });

  scored.sort((a, b) => a.score - b.score);
  scored.forEach((s) => grid.appendChild(s.card));

  if (note) {
    note.textContent = goodOutdoor
      ? '☀️ Clear out there — outdoor guides moved to the top.'
      : '🌧️ Not the best outside right now — indoor guides moved to the top.';
    note.classList.remove('hidden');
  }

  guidesReordered = true;
}

const guidesReorderInterval = setInterval(() => {
  if (currentWeatherCode !== null && currentWeatherCode !== undefined) {
    reorderGuidesForWeather();
    clearInterval(guidesReorderInterval);
  }
}, 3000);


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


// --- SHAREABLE RESULT IMAGES (quiz result, wheel spin) ---
// Draws a simple branded square image on canvas and offers it as a download —
// no external libraries, so quality is intentionally kept simple and reliable
// rather than trying to rasterize arbitrary HTML.
function canvasWrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  const lines = [];
  words.forEach((word, i) => {
    const testLine = line + word + ' ';
    if (ctx.measureText(testLine).width > maxWidth && i > 0) {
      lines.push(line.trim());
      line = word + ' ';
    } else {
      line = testLine;
    }
  });
  lines.push(line.trim());
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => ctx.fillText(l, x, startY + i * lineHeight));
  return lines.length;
}

function generateShareableImage({ emoji, title, subtitle }) {
  const size = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#0B1D33');
  grad.addColorStop(0.55, '#1B3A5C');
  grad.addColorStop(1, '#C1440E');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Simplified bridge silhouette along the bottom
  ctx.fillStyle = '#2A0E06';
  const deckY = size * 0.82;
  ctx.fillRect(size * 0.08, deckY, size * 0.84, size * 0.012);
  ctx.fillRect(size * 0.30, size * 0.58, size * 0.045, deckY - size * 0.58);
  ctx.fillRect(size * 0.655, size * 0.58, size * 0.045, deckY - size * 0.58);

  ctx.textAlign = 'center';

  ctx.font = `${size * 0.16}px sans-serif`;
  ctx.fillText(emoji, size / 2, size * 0.32);

  ctx.fillStyle = '#FBFAF8';
  ctx.font = `bold ${size * 0.062}px -apple-system, "Segoe UI", Roboto, sans-serif`;
  canvasWrapText(ctx, title, size / 2, size * 0.46, size * 0.82, size * 0.075);

  ctx.fillStyle = '#E9EDF0';
  ctx.font = `${size * 0.032}px -apple-system, "Segoe UI", Roboto, sans-serif`;
  canvasWrapText(ctx, subtitle, size / 2, size * 0.585, size * 0.78, size * 0.042);

  ctx.fillStyle = '#F2A65A';
  ctx.font = `bold ${size * 0.03}px -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.fillText('SF TODAY', size / 2, size * 0.94);

  return canvas;
}

function downloadShareableImage(canvas, filename) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
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
      <button type="button" id="quiz-download-btn" class="secondary-btn">📸 Download as Image</button>
      <button type="button" id="quiz-retake-btn" class="secondary-btn">Retake Quiz</button>
    </div>
  `;

  if (typeof launchConfetti === 'function') launchConfetti();

  document.getElementById('quiz-download-btn').addEventListener('click', function() {
    const nameParts = resultName.split(' ');
    const emoji = nameParts[0];
    const nameOnly = nameParts.slice(1).join(' ');
    const canvas = generateShareableImage({
      emoji: emoji,
      title: `You're ${nameOnly}!`,
      subtitle: 'Which SF Neighborhood Are You? — take the quiz yourself'
    });
    downloadShareableImage(canvas, 'sf-today-neighborhood-result.png');
  });

  document.getElementById('quiz-see-guide-btn').addEventListener('click', function() {
    closeQuiz();
    if (neighborhoods[winningKey]) {
      resultsTitle.textContent = resultName;
      currentPlanItems = neighborhoods[winningKey];
      itineraryContent.innerHTML = buildItineraryHtml(neighborhoods[winningKey]);
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
  { key: 'eat', label: 'Eat', emoji: '🍜', desc: 'A place to grab food' },
  { key: 'free', label: 'Free Thing', emoji: '💰', desc: 'Something fun that costs nothing' },
  { key: 'outdoor', label: 'Outdoor', emoji: '☀️', desc: 'A park, trail, or outdoor spot' },
  { key: 'history', label: 'History', emoji: '🏛️', desc: 'A piece of SF\'s past' },
  { key: 'gem', label: 'Hidden Gem', emoji: '⭐', desc: 'This week\'s local favorite' },
  { key: 'neighborhood', label: 'Neighborhood', emoji: '🧭', desc: 'A pick from a random SF neighborhood' },
  { key: 'sight', label: 'Sight', emoji: '🌉', desc: 'A classic must-see landmark' },
  { key: 'trivia', label: 'Trivia', emoji: '📜', desc: 'A fun fact instead of a place' }
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
    case 'history': list = evergreenCategories.history; break;
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
  let imageTitle;
  let imageSubtitle;

  if (segment.key === 'trivia' && typeof triviaFacts !== 'undefined') {
    const fact = triviaFacts[sfDayOfYear() % triviaFacts.length];
    shareText = `Today's SF Today wheel landed on Trivia: ${fact}`;
    imageTitle = "Today's SF Trivia";
    imageSubtitle = fact;
    resultEl.innerHTML = `
      <p class="wheel-landed-label">${segment.emoji} Landed on: <strong>${segment.label}</strong></p>
      <div class="plan-item">
        <h3>Today's SF Trivia</h3>
        <p>💡 ${fact}</p>
      </div>
      <div class="wheel-result-actions">
        <button type="button" id="wheel-share-btn" class="secondary-btn">Share This Pick</button>
        <button type="button" id="wheel-download-btn" class="secondary-btn">📸 Download as Image</button>
      </div>
    `;
  } else {
    const item = pickWheelItem(segment.key);
    if (!item) {
      resultEl.innerHTML = `<p class="no-events-message">Couldn't pull today's pick — try refreshing.</p>`;
      return;
    }
    currentPlanItems = [item];
    shareText = `The SF Today wheel landed on ${segment.label} — ${item.title}${item.address ? ' at ' + item.address : ''}!`;
    imageTitle = item.title;
    imageSubtitle = `Today's wheel pick: ${segment.label}`;
    resultEl.innerHTML = `
      <p class="wheel-landed-label">${segment.emoji} Landed on: <strong>${segment.label}</strong></p>
      ${buildVenueCard(item)}
      <div class="wheel-result-actions">
        <button type="button" id="wheel-share-btn" class="secondary-btn">Share This Pick</button>
        <button type="button" id="wheel-download-btn" class="secondary-btn">📸 Download as Image</button>
      </div>
    `;
  }

  resultEl.classList.remove('hidden');

  const wheelDownloadBtn = document.getElementById('wheel-download-btn');
  if (wheelDownloadBtn) {
    wheelDownloadBtn.addEventListener('click', function() {
      const canvas = generateShareableImage({
        emoji: segment.emoji,
        title: imageTitle,
        subtitle: imageSubtitle
      });
      downloadShareableImage(canvas, 'sf-today-wheel-result.png');
    });
  }

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

// --- Live countdown to San Francisco's actual next midnight ---
// (Not UTC, not the visitor's own timezone — real SF time, same fix as the
// rest of the site's daily-reset logic.)
function getSFUTCOffsetMinutes(date = new Date()) {
  const utcAsLocal = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const sfAsLocal = new Date(date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  return Math.round((utcAsLocal - sfAsLocal) / 60000);
}

function getNextSFMidnightTimestamp() {
  const now = new Date();
  const offsetMinutes = getSFUTCOffsetMinutes(now);
  const [y, m, d] = sfDateStamp(now).split('-').map(Number);
  const utcMidnightOfNextSFDate = Date.UTC(y, m - 1, d + 1, 0, 0, 0);
  return utcMidnightOfNextSFDate + offsetMinutes * 60000;
}

function formatWheelCountdown(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

let wheelCountdownInterval = null;

function startWheelCountdown() {
  const statusEl = document.getElementById('wheel-status');
  if (!statusEl) return;
  if (wheelCountdownInterval) clearInterval(wheelCountdownInterval);

  const target = getNextSFMidnightTimestamp();

  function tick() {
    const remaining = target - Date.now();
    if (remaining <= 0) {
      clearInterval(wheelCountdownInterval);
      resetWheelForNewDay();
      return;
    }
    statusEl.textContent = `⏳ Next spin unlocks in ${formatWheelCountdown(remaining)}`;
  }

  tick();
  wheelCountdownInterval = setInterval(tick, 1000);
}

function resetWheelForNewDay() {
  const wheelGroup = document.getElementById('wheel-rotate-group');
  const resultEl = document.getElementById('wheel-result');
  if (!wheelGroup) return;

  wheelGroup.style.transition = 'none';
  wheelGroup.style.transform = 'rotate(0deg)';
  if (resultEl) {
    resultEl.classList.add('hidden');
    resultEl.innerHTML = '';
  }
  setupWheelForToday();
}

function setupWheelForToday() {
  const wheelGroup = document.getElementById('wheel-rotate-group');
  const spinBtn = document.getElementById('wheel-spin-btn');
  const statusEl = document.getElementById('wheel-status');
  const wheelWrap = document.getElementById('wheel-wrap');
  if (!wheelGroup || !spinBtn || !statusEl) return;

  const winningIndex = getWheelWinningIndex();
  const segAngle = 360 / WHEEL_SEGMENTS.length;
  const centerAngle = winningIndex * segAngle + segAngle / 2;
  const winningSegment = WHEEL_SEGMENTS[winningIndex];

  if (hasSpunWheelToday()) {
    if (wheelWrap) wheelWrap.classList.remove('wheel-idle');
    wheelGroup.style.transition = 'none';
    wheelGroup.style.transform = `rotate(${wheelRestingRotation(centerAngle)}deg)`;
    renderWheelResult(winningSegment);
    spinBtn.disabled = true;
    spinBtn.textContent = 'Come Back Tomorrow';
    startWheelCountdown();
    return;
  }

  if (wheelCountdownInterval) {
    clearInterval(wheelCountdownInterval);
    wheelCountdownInterval = null;
  }
  spinBtn.disabled = false;
  spinBtn.textContent = 'Spin the Wheel';
  statusEl.textContent = '';

  // Using .onclick (not addEventListener) so re-running this at midnight
  // replaces the old handler cleanly instead of stacking duplicates.
  spinBtn.onclick = function() {
    spinBtn.disabled = true;
    statusEl.textContent = 'Spinning...';
    if (wheelWrap) wheelWrap.classList.remove('wheel-idle');

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
      spinBtn.textContent = 'Come Back Tomorrow';
      startWheelCountdown();
    }, 3500);
  };
}

function renderWheelLegend() {
  const legendEl = document.getElementById('wheel-legend');
  if (!legendEl) return;
  legendEl.innerHTML = WHEEL_SEGMENTS.map((seg) => `
    <div class="wheel-legend-item">
      <span class="wheel-legend-emoji">${seg.emoji}</span>
      <span class="wheel-legend-text">
        <strong>${seg.label}</strong>
        <span>${seg.desc}</span>
      </span>
    </div>
  `).join('');
}

(function initWheel() {
  const wheelGroup = buildWheelSVG();
  if (!wheelGroup) return;
  renderWheelLegend();
  setupWheelForToday();
})();


// --- QUICK NAV: highlight the active section while scrolling ---
(function initQuickNavHighlight() {
  const navLinks = document.querySelectorAll('.quick-nav-scroll a');
  const scrollContainer = document.querySelector('.quick-nav-scroll');
  if (!navLinks.length || !scrollContainer || !('IntersectionObserver' in window)) return;

  const linksByTarget = {};
  navLinks.forEach((link) => {
    const id = link.getAttribute('href').slice(1);
    linksByTarget[id] = link;
  });

  // Keeps the active pill visible WITHIN the horizontal nav strip only —
  // deliberately never touches window/page scroll (that was the bug: the
  // previous version used link.scrollIntoView(), which considers every
  // scrollable ancestor including the page itself, and fought the user's
  // own scrolling — especially awkward combined with a sticky nav).
  function keepActiveLinkVisible(link) {
    const targetLeft = link.offsetLeft - (scrollContainer.clientWidth / 2) + (link.clientWidth / 2);
    scrollContainer.scrollTo({
      left: Math.max(0, targetLeft),
      behavior: 'smooth'
    });
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const link = linksByTarget[entry.target.id];
      if (!link) return;
      if (entry.isIntersecting) {
        navLinks.forEach((l) => l.classList.remove('active'));
        link.classList.add('active');
        keepActiveLinkVisible(link);
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px' }); // fires when a section crosses the vertical middle of the viewport

  Object.keys(linksByTarget).forEach((id) => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });
})();
