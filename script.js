// --- 1. SET DYNAMIC DAY OF THE WEEK ---
const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const today = new Date();
document.getElementById('day-title').textContent = `It's ${days[today.getDay()]}. Here's what's worth doing in San Francisco.`;


// --- 2. PERMANENT / EVERGREEN CONTENT DATABASE ---
const evergreenCategories = {
  dinner: `
    <div class="plan-item"><h3>Mission District Burritos</h3><p>Head to El Farolito or La Taqueria for world-famous, consistently great Mission-style burritos.</p></div>
    <div class="plan-item"><h3>Chinatown Dim Sum</h3><p>Stop by Good Mong Kok Bakery for cheap, incredibly delicious pork buns to-go.</p></div>
    <div class="plan-item"><h3>North Beach Italian</h3><p>Grab a slice of classic sourdough crust pizza at Tony's Pizza Napoletana.</p></div>
  `,
  family: `
    <div class="plan-item"><h3>Exploratorium</h3><p>An amazing hands-on science museum located on Pier 15 that kids and adults both love.</p></div>
    <div class="plan-item"><h3>California Academy of Sciences</h3><p>Features an aquarium, planetarium, and a 4-story rainforest inside Golden Gate Park.</p></div>
    <div class="plan-item"><h3>Golden Gate Park Carousel</h3><p>Historic 1914 carousel with hand-carved animals right next to the Koret Children's Quarter playground.</p></div>
  `,
  free: `
    <div class="plan-item"><h3>Palace of Fine Arts</h3><p>Stroll around the stunning Greco-Roman rotunda and peaceful lagoon.</p></div>
    <div class="plan-item"><h3>Golden Gate Bridge Walk</h3><p>Walk or bike across the iconic orange span completely for free from the Welcome Center.</p></div>
    <div class="plan-item"><h3>Cable Car Museum</h3><p>Visit the actual powerhouse and museum on Nob Hill to see how the historic cable cars operate.</p></div>
  `,
  visit: `
    <div class="plan-item"><h3>Alcatraz Island</h3><p>Take the ferry out to explore the legendary former federal prison (book tickets in advance!).</p></div>
    <div class="plan-item"><h3>Twin Peaks</h3><p>Drive or hike up to the geographic center of SF for sweeping 360-degree views of the entire Bay Area.</p></div>
    <div class="plan-item"><h3>Lombard Street</h3><p>See the famous "crookedest street in the world" wrapped in manicured hydrangeas.</p></div>
  `,
  outdoors: `
    <div class="plan-item"><h3>Lands End Trail</h3><p>A dramatic coastal hiking trail featuring cypress trees, ocean views, and a hidden stone labyrinth.</p></div>
    <div class="plan-item"><h3>Dolores Park</h3><p>The ultimate gathering spot in the Mission for sunbathing, palm trees, and city skyline views.</p></div>
    <div class="plan-item"><h3>Crissy Field</h3><p>A flat, scenic waterfront path stretching from Fort Point to the Marina Green.</p></div>
  `,
  dating: `
    <div class="plan-item"><h3>Conservatory of Flowers</h3><p>Wander through historic, fairytale-like glass greenhouses filled with rare tropical plants.</p></div>
    <div class="plan-item"><h3>Musée Mécanique</h3><p>A nostalgic arcade at Fisherman's Wharf packed with vintage, coin-operated mechanical games.</p></div>
    <div class="plan-item"><h3>Marshall's Beach</h3><p>A secluded, romantic sandy beach tucked away near the base of the Golden Gate Bridge.</p></div>
  `,
  transit: `
    <div class="plan-item"><h3>Golden Rule of Parking</h3><p>Never leave anything visible in your car in SF—not even a jacket or an empty bag!</p></div>
    <div class="plan-item"><h3>Muni & BART</h3><p>Use the Muni mobile app or a Clipper card to seamlessly hop on buses, light rails, and cable cars.</p></div>
    <div class="plan-item"><h3>Embarcadero Walkability</h3><p>Much of the downtown waterfront is completely flat and best explored on foot or by rented bike.</p></div>
  `,
  stories: `
    <div class="plan-item"><h3>Moving National Landmarks</h3><p>San Francisco's cable cars are the only moving National Historic Landmarks in the United States.</p></div>
    <div class="plan-item"><h3>The Fog Has a Name</h3><p>San Francisco's iconic summer fog is affectionately nicknamed "Karl the Fog."</p></div>
    <div class="plan-item"><h3>Built on Hills</h3><p>San Francisco is built on more than 40 distinct hills, though historical estimates often list 7 or more major ones.</p></div>
  `
};


// --- 3. FILTER PLANNER DATABASE ---
const activities = [
  { title: "Dim Sum & Shopping in Chinatown", desc: "Grab cheap pork buns and browse the shops on Grant Ave.", personas: ["teen", "tourist", "parent"], budget: "low", time: "short" },
  { title: "Golden Gate Park Mega-Day", desc: "Rent a boat at Stow Lake, visit the Academy of Sciences, and see the Bison.", personas: ["parent", "tourist"], budget: "high", time: "long" },
  { title: "Sunset at Dolores Park", desc: "Bring a blanket, grab ice cream, and watch the sunset over the city skyline.", personas: ["date", "teen"], budget: "low", time: "short" },
  { title: "Free Museum Day & Ferry Building", desc: "Check out public art spaces, then take Muni to the Ferry Building.", personas: ["tourist", "parent"], budget: "free", time: "long" },
  { title: "Dinner & A Concert Night Out", desc: "Great local dining followed by live music at an intimate venue.", personas: ["date"], budget: "high", time: "long" },
  { title: "Hike to the Labyrinth", desc: "Hike the Lands End trail to the secret rock labyrinth. Amazing bridge views.", personas: ["teen", "date"], budget: "free", time: "short" }
];


// --- 4. INTERACTIVITY LOGIC ---
const generateBtn = document.getElementById('generate-btn');
const resultsSection = document.getElementById('results-section');
const resultsTitle = document.getElementById('results-title');
const itineraryContent = document.getElementById('itinerary-content');
const closeBtn = document.getElementById('close-btn');
const dashCards = document.querySelectorAll('.dash-card');

// Handle Custom Planner Button
generateBtn.addEventListener('click', function() {
  const p = document.getElementById('persona').value;
  const b = document.getElementById('budget').value;
  const t = document.getElementById('time').value;

  const matches = activities.filter(activity => {
    return activity.personas.includes(p) && activity.budget === b && activity.time === t;
  });

  let htmlString = "";
  if (matches.length > 0) {
    matches.forEach(match => {
      htmlString += `<div class="plan-item"><h3>${match.title}</h3><p>${match.desc}</p></div>`;
    });
  } else {
    htmlString = `<div class="plan-item"><h3>Explore the Waterfront</h3><p>You can never go wrong with a classic walk from the Ferry Building to Pier 39!</p></div>`;
  }

  resultsTitle.textContent = "Your Custom Itinerary";
  itineraryContent.innerHTML = htmlString;
  resultsSection.classList.remove('hidden');
});

// Handle Dashboard Card Clicks
dashCards.forEach(card => {
  card.addEventListener('click', function() {
    const categoryKey = this.getAttribute('data-category');
    const cardText = this.textContent;

    if (evergreenCategories[categoryKey]) {
      resultsTitle.textContent = cardText;
      itineraryContent.innerHTML = evergreenCategories[categoryKey];
      resultsSection.classList.remove('hidden');
      
      // Smoothly scroll down to the results box
      resultsSection.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// Handle Close Button
closeBtn.addEventListener('click', function() {
  resultsSection.classList.add('hidden');
});
