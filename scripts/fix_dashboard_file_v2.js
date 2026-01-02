const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../app/(protected)/dashboard/page.tsx');
const content = fs.readFileSync(filePath, 'utf8');

// The block starts right after the valid PendingTasks function scope ends
// Look for lines 377-380 area where the `// For ACCOUNTING roles...` comment is
const startMarker = `  // For ACCOUNTING roles, show funding requests and POs needing approval`;

// The block ends right before `async function RecentProjects()`
const endMarker = `async function RecentProjects() {`;

const startIdx = content.indexOf(startMarker);
const endIdx = content.lastIndexOf(endMarker);

if (startIdx === -1) {
    console.error('Start marker not found');
    process.exit(1);
}

if (endIdx === -1) {
    console.error('End marker not found');
    process.exit(1);
}

if (startIdx >= endIdx) {
    console.error('Start index (' + startIdx + ') is >= end index (' + endIdx + ')');
    process.exit(1);
}

// Ensure ensure we preserve the closing brace of the previous function if it was cut off or duplicated
// But based on file view, line 376 is `    );` and 377 is `  }`.
// The `PendingTasks` function *should* end there.
// The orphaned block starts *after* that closing brace.

console.log(`Deleting from index ${startIdx} to ${endIdx}`);

const newContent = content.substring(0, startIdx) + '\n\n' + content.substring(endIdx);
fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Orphaned block removed.');
