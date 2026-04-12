// Configuration Supabase
const SUPABASE_URL = "https://oaxpofkmtrudriyrbxvy.supabase.co";
const BUCKET_NAME = "dishes-images";
const client = supabase.createClient(SUPABASE_URL, "sb_publishable_W0bTuLBKIo_-tSVK_XfKYg_LScZ_5EY");

const cache = {};
let currentCategory = null;
const detail = document.getElementById("dish-detail");
const backButton = document.getElementById("back-button");

/**
 * Gère l'affichage du bouton retour de manière centralisée
 */
function updateBackButton() {
    const isDetailOpen = detail.classList.contains("active");
    const isMenuOpen = currentCategory !== null;

    if (isDetailOpen || isMenuOpen) {
        backButton.classList.remove("hidden");
    } else {
        backButton.classList.add("hidden");
    }
}

function getImageUrlFromPath(imagePath) {
    if (!imagePath) return "";
    return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${imagePath}`;
}

async function showCategory(category) {
    const container = document.getElementById("menu");
    
    if (currentCategory === category) {
        closeMenuAnimation();
        return;
    }
    
    currentCategory = category;

    // ÉTAPE 1 : Affichage immédiat d'un loader global pour confirmer l'action sur mauvaise connexion
    container.innerHTML = `
        <div id="global-loader" style="padding: 60px; display: flex; justify-content: center; width: 100%;">
            <div class="loader">
                <svg width="60" height="60">
                    <circle cx="30" cy="30" r="20" fill="none" stroke-width="3" class="stroke-still"></circle>
                    <circle cx="30" cy="30" r="20" fill="none" stroke-width="3" class="stroke-animation"></circle>
                </svg>
            </div>
        </div>`;

    document.querySelectorAll("#navigation button").forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute('data-cat') === category);
    });

    updateBackButton();

    // ÉTAPE 2 : Récupération des données (pendant que le loader global tourne)
    let groupedData;
    if (cache[category]) {
        groupedData = cache[category];
    } else {
        const { data, error } = await client.from("dishes").select("*").eq("category", category).eq("available", true);
        if (error) {
            container.innerHTML = "<p>Erreur de chargement des données.</p>";
            return;
        }
        groupedData = data.reduce((acc, dish) => {
            const sub = dish.subcategory || "_no_sub";
            if (!acc[sub]) acc[sub] = [];
            acc[sub].push(dish);
            return acc;
        }, {});
        cache[category] = groupedData;
    }

    // ÉTAPE 3 : Affichage immédiat de la structure (Titres + Cards avec loaders individuels)
    displayCategory(groupedData);
}

function displayCategory(grouped) {
    const container = document.getElementById("menu");
    container.innerHTML = ""; 

    Object.entries(grouped).forEach(([sub, dishes]) => {
        const title = document.createElement("h2");
        title.textContent = sub === "_no_sub" ? "La Sélection" : sub;
        container.appendChild(title);

        const groupDiv = document.createElement("div");
        groupDiv.className = "category-group";

        dishes.forEach((dish, index) => {
            const card = document.createElement("div");
            card.className = "card loading"; 

            card.innerHTML = `
                <div class="loader">
                    <svg width="60" height="60">
                        <circle cx="30" cy="30" r="20" fill="none" stroke-width="3" class="stroke-still"></circle>
                        <circle cx="30" cy="30" r="20" fill="none" stroke-width="3" class="stroke-animation"></circle>
                    </svg>
                </div>
            `;
            groupDiv.appendChild(card);

            // ÉTAPE 4 : Chargement des images en tâche de fond avec délai minimum forcé
            const img = new Image();
            const startTime = Date.now();
            const minDelay = 500 + (index * 150); 

            const revealCard = () => {
                const elapsed = Date.now() - startTime;
                const remaining = Math.max(0, minDelay - elapsed);

                setTimeout(() => {
                    const displayPrice = (dish.price === 0 || dish.price === "0") ? "Inclus" : `${dish.price} €`;
                    card.innerHTML = `
                        <img src="${img.src}" alt="${dish.name}">
                        <div class="card-text-wrapper">
                            <h3>${dish.name}</h3>
                            <div class="price-tag">${displayPrice}</div>
                        </div>
                    `;
                    card.classList.remove("loading");
                    card.classList.add("loaded");
                    card.onclick = () => showDetail(dish);
                }, remaining);
            };

            img.onload = revealCard;
            img.onerror = revealCard; 
            img.src = getImageUrlFromPath(dish.image_path);
            
            if (img.complete) {
                requestAnimationFrame(() => revealCard());
            }
        });
        container.appendChild(groupDiv);
    });

    window.scrollTo({ top: container.offsetTop - 80, behavior: 'smooth' });
}

function showDetail(dish) {
    const displayPrice = (dish.price === 0 || dish.price === "0") ? "Inclus" : `${dish.price} €`;
    let extraContent = "";
    if (dish.description?.trim()) extraContent += `<p style="margin-top:20px;">${dish.description}</p>`;
    if (dish.ingredients?.trim()) {
        extraContent += `<p style="font-size:0.9rem; opacity:0.8; font-style:italic; margin-top:15px; border-top: 1px solid #e0dbd0; padding-top:10px;">${dish.ingredients}</p>`;
    }

    detail.innerHTML = `
        <div class="zoom-container" onclick="closeDetail()">
            <img src="${getImageUrlFromPath(dish.image_path)}" class="zoom-image">
            <div class="zoom-info" onclick="event.stopPropagation()">
                <h2>${dish.name}</h2>
                <div style="font-size:1.5rem; color:#c06c4c; font-family:'Cormorant Garamond', serif;">${displayPrice}</div>
                ${extraContent}
            </div>
        </div>
    `;
    
    detail.classList.add("active");
    detail.classList.remove("hidden");
    document.body.classList.add("overlay-open");
    updateBackButton();
}

function closeDetail() {
    detail.classList.remove("active");
    detail.classList.add("hidden");
    document.body.classList.remove("overlay-open");
    updateBackButton();
}

function closeMenuAnimation() {
    currentCategory = null;
    document.getElementById("menu").innerHTML = "";
    document.querySelectorAll("#navigation button").forEach(btn => btn.classList.remove("active"));
    updateBackButton();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

backButton.onclick = () => {
    if (detail.classList.contains("active")) {
        closeDetail();
    } else if (currentCategory) {
        closeMenuAnimation();
    }
};

document.addEventListener("DOMContentLoaded", () => {
    const nav = document.getElementById("navigation");
    const labels = { 
        entree: "Entrées", 
        plat: "Plats", 
        accompagnement: "Accompagnements",
        dessert: "Desserts", 
        boisson: "Boissons" 
    };
    Object.keys(labels).forEach(cat => {
        const btn = document.createElement("button");
        btn.textContent = labels[cat];
        btn.setAttribute('data-cat', cat);
        btn.onclick = () => showCategory(cat);
        nav.appendChild(btn);
    });
    updateBackButton();
});
