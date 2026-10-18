import fs from 'node:fs';

function patchBetaHtml(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace any existing patch first so it's clean
  content = content.replace(/<a class="demo-label[^"]*" href="\/"[^>]*>[\s\S]*?<\/a>/g, '');
  content = content.replace(/<a class="nav-item" href="\/"[^>]*>[\s\S]*?<\/a>/g, '');

  // Add topbar link
  const topbarTarget = '<button class="demo-label" data-action="review"><span class="pill-dot"></span>Design exploration</button>';
  const topbarReplacement = '<a class="demo-label classic-return" href="/" style="text-decoration:none; color:var(--gold); border-color:#63583d; flex-shrink:0" title="Return to Classic Luna">← Classic</a>' + topbarTarget;
  if (content.includes(topbarTarget)) {
    content = content.replace(topbarTarget, topbarReplacement);
    console.log('Patched topbar in', filePath);
  }

  // Add sidebar link
  const sidebarTarget = '<button class="nav-item" data-action="review">${icon(\'settings\',18)}Explore this prototype</button>';
  const sidebarReplacement = '<a class="nav-item" href="/" style="color:var(--gold)">${icon(\'back\',18)}Classic Luna</a>' + sidebarTarget;
  if (content.includes(sidebarTarget)) {
    content = content.replace(sidebarTarget, sidebarReplacement);
    console.log('Patched sidebar in', filePath);
  }

  fs.writeFileSync(filePath, content, 'utf8');
}

patchBetaHtml('public/beta/index.html');
patchBetaHtml('public/beta.html');

// Also update review.html
let review = fs.readFileSync('public/beta/review.html', 'utf8');
const reviewNavTarget = '<nav aria-label="Review viewport">';
const reviewNavReplacement = '<nav aria-label="Review viewport"><a href="/" class="button" style="color:#dbc18c;margin-right:8px">← Classic Luna</a>';
if (review.includes(reviewNavTarget) && !review.includes('← Classic Luna')) {
  review = review.replace(reviewNavTarget, reviewNavReplacement);
  fs.writeFileSync('public/beta/review.html', review, 'utf8');
  console.log('Patched review.html');
}
