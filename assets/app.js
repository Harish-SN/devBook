//Config
const SECTIONS = [
    { id: "linux", title: "Linux", file: "sections/linux.html", tags: "linux bash systemctl journalctl sed awk grep common commands" },
    { id: "mac", title: "Mac", file: "sections/mac.html", tags: "macos brew terminal zsh commands" },
    { id: "windows", title: "Windows", file: "sections/windows.html", tags: "windows powershell cmd chocolatey wsl" },
    { id: "git", title: "Git & Version Control", file: "sections/git.html", tags: "git version control rebase stash branch merge" },
    { id: "aws-cli", title: "AWS CLI", file: "sections/aws-cli.html", tags: "aws cli configure profile sts sso iam ec2 s3 dynamodb lambda eks" },
    { id: "aws-sdk", title: "AWS SDK", file: "sections/aws-sdk.html", tags: "aws sdk boto3 nodejs python s3 dynamodb lambda" },
    { id: "ec2-main", title: "EC2 Maintenance", file: "sections/ec2-main.html", tags: "ec2 maintenance patch update amazon linux dnf" },
    { id: "docker", title: "Docker", file: "sections/docker.html", tags: "docker build push compose images containers" },
    { id: "nginx", title: "Nginx", file: "sections/nginx.html", tags: "nginx reverse proxy tls load balancer" },
    { id: "pm2", title: "PM2", file: "sections/pm2.html", tags: "pm2 node process manager ecosystem logs deploy" },
    { id: "cicd", title: "CI/CD", file: "sections/cicd.html", tags: "ci cd github actions pipelines kubectl helm deploy" },
    { id: "kubernetes", title: "Kubernetes", file: "sections/kubernetes.html", tags: "k8s kubernetes pods deployments services configmaps secrets ingress" },
    { id: "prometheus", title: "Prometheus", file: "sections/prometheus.html", tags: "prometheus monitoring promql scrape metrics" },
    { id: "grafana", title: "Grafana", file: "sections/grafana.html", tags: "grafana dashboards visualization datasource" },

];
//Utilities
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

async function fetchText(url) {
    try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return await res.text();
    } catch (e) {
        console.error("Fetch failed:", url, e);
        return `<div class="grid"><div class="card"><div class="card-head">Load Error</div><div class="code"><pre>Failed to load ${url}\n${e}</pre></div></div></div>`;
    }
}
//Partials
async function loadPartials() {
    const [navHtml, footerHtml] = await Promise.all([
        fetchText('partials/nav.html'),
        fetchText('partials/footer.html'),
    ]);
    $('#nav-slot').innerHTML = navHtml;
    $('#footer-slot').innerHTML = footerHtml;

    const links = $('#nav-links');
    if (links) {
        links.innerHTML = SECTIONS.map(s => `<a href="#${s.id}" data-id="${s.id}">${s.title}</a>`).join('');
    }

    // Hamburger toggle
    const btn = $('#nav-toggle');
    if (btn && links) {
        btn.addEventListener('click', () => {
            const open = links.classList.toggle('open');
            btn.classList.toggle('open', open);
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
    }

    // Close mobile menu when going desktop
    window.addEventListener('resize', () => {
        if (window.innerWidth >= 900) {
            links?.classList.remove('open');
            $('#nav-toggle')?.classList.remove('open');
        }
    });
}
//Sections
async function loadSections() {
    const htmls = await Promise.all(
        SECTIONS.map(async s => {
            const markup = await fetchText(s.file);
            const withAnchor = markup.replace(
                /<h2>([^<]+)<\/h2>/i,
                (_, title) => `<h2><span class="htext">${title}</span> <a class="sec-anchor" href="#${s.id}" title="Copy link">🔗</a></h2>`
            );
            return `<section id="${s.id}" data-tags="${s.tags}">${withAnchor}</section>`;
        })
    );
    $('#sections-slot').innerHTML = htmls.join('\n');

    convertDetailsToCards();
    setupCopy();
    setupSearch();
    setupScrollSpy();

    if (location.hash) {
        document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Convert to .card
function convertDetailsToCards() {
    $$('#sections-slot details').forEach(d => {
        const title = d.querySelector('summary')?.textContent?.trim() || '';
        const card = document.createElement('div'); card.className = 'card';
        const head = document.createElement('div'); head.className = 'card-head'; head.textContent = title;

        const frag = document.createDocumentFragment();
        Array.from(d.childNodes).forEach(node => {
            if (node.nodeType === 1 && node.tagName === 'SUMMARY') return;
            frag.appendChild(node);
        });

        card.appendChild(head);
        if (!frag.firstElementChild || !frag.firstElementChild.classList?.contains('code')) {
            const body = document.createElement('div'); body.className = 'code'; body.appendChild(frag); card.appendChild(body);
        } else {
            card.appendChild(frag);
        }
        d.replaceWith(card);
    });
}

// Copy buttons
function setupCopy() {
    document.addEventListener('click', ev => {
        const btn = ev.target.closest('.copy');
        if (!btn) return;
        const id = btn.getAttribute('data-target');
        const el = document.getElementById(id);
        const text = el?.innerText || '';
        navigator.clipboard.writeText(text).then(() => {
            const old = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(() => btn.textContent = old, 1200);
        }).catch(console.error);
    });
}

// Search
function setupSearch() {
    const q = $('#q'); if (!q) return;
    const meta = $('.search-meta');
    const sections = $$('section');

    const norm = s => (s || '').toLowerCase();
    const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    function clearMarks(el) {
        if (!el) return;
        el.querySelectorAll('mark').forEach(m => m.replaceWith(document.createTextNode(m.textContent)));
    }

    function highlightIn(el, needle) {
        if (!el || !needle) return 0;
        const re = new RegExp(escapeRe(needle), 'gi');
        let count = 0;
        const text = el.textContent;
        if (!text) return 0;
        const replaced = text.replace(re, m => { count++; return `<mark>${m}</mark>`; });
        if (count) el.innerHTML = replaced;
        return count;
    }

    function filter() {
        const needle = norm(q.value.trim());
        let totalMatches = 0;

        sections.forEach(section => {
            const titleSpan = section.querySelector('h2 .htext') || section.querySelector('h2');
            clearMarks(titleSpan);

            if (!needle) {
                section.classList.remove('hidden');
                return;
            }

            const matched = norm(titleSpan.textContent).includes(needle);
            section.classList.toggle('hidden', !matched);

            if (matched) {
                totalMatches += highlightIn(titleSpan, needle);
            }
        });

        if (meta) {
            meta.textContent = needle
                ? `${totalMatches} match${totalMatches === 1 ? '' : 'es'} in titles`
                : '';
        }
    }

    q.addEventListener('input', filter);
}

// Scrollspy
function setupScrollSpy() {
    const links = $$('#nav-links a'); if (!links.length) return;
    const secs = SECTIONS.map(s => document.getElementById(s.id)).filter(Boolean);

    const io = new IntersectionObserver(entries => {
        entries.forEach(e => {
            if (!e.isIntersecting) return;
            const id = e.target.id;
            links.forEach(a => a.classList.toggle('active', a.getAttribute('data-id') === id));
            if (document.activeElement?.id !== 'q') history.replaceState(null, '', `#${id}`);
        });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

    secs.forEach(sec => io.observe(sec));
}

// Boot
(async function init() {
    if (document.readyState === 'loading') {
        await new Promise(res => document.addEventListener('DOMContentLoaded', res, { once: true }));
    }
    await loadPartials();
    await loadSections();
})();