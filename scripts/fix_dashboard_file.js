const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../app/(protected)/dashboard/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Identifier for the end of PendingTasks function in my recent edit
// It ends with:
//   // Fallback for other roles or no specific matches
//   return (
//     <div className="rounded-lg bg-white p-6 shadow">
//       <h3 className="text-lg font-medium leading-6 text-gray-900">Pending Tasks</h3>
//       <div className="mt-4">
//          <p className="text-sm text-gray-500">No pending tasks found for your role.</p>
//       </div>
//     </div>
//   );
// }

const endMarker = `  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h3 className="text-lg font-medium leading-6 text-gray-900">Pending Tasks</h3>
      <div className="mt-4">
         <p className="text-sm text-gray-500">No pending tasks found for your role.</p>
      </div>
    </div>
  );
}`;

// Identifier for valid RecentProjects start
const startMarker = `async function RecentProjects() {`;

const endIdx = content.indexOf(endMarker);
const startIdx = content.lastIndexOf(startMarker); // Use lastIndexOf to be safe, though there should be only one actual definition if duplicates exist

if (endIdx === -1) {
    console.error('End marker not found');
    process.exit(1);
}

if (startIdx === -1) {
    console.error('Start marker not found');
    process.exit(1);
}

// Find the closing brace of PendingTasks after the endMarker
const closeBraceIdx = content.indexOf('}', endIdx + endMarker.length); // The '}' for PendingTasks

if (closeBraceIdx === -1) {
    console.error('Closing brace not found');
    process.exit(1);
}

// Check if we have a gap to delete
if (closeBraceIdx < startIdx) {
    console.log(`Deleting content between index ${closeBraceIdx + 1} and ${startIdx}`);
    const newContent = content.substring(0, closeBraceIdx + 1) + '\n\n\n' + content.substring(startIdx);
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log('File updated successfully.');
} else {
    console.log('No gap found or markers in wrong order.');
}
