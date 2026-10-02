/**
 * IndexedDB storage module for Digital Diary
 * Handles persistent storing, loading, deleting, and reordering of Canva pages.
 * Includes default pre-loaded sequential Canva pages (1.png to 7.png).
 */

const DB_NAME = 'OurLittleDiaryDB';
const DB_VERSION = 1;
const STORE_NAME = 'pages';

const INITIAL_DEFAULT_PAGES = [
  'images/1.png',
  'images/2.png',
  'images/3.png',
  'images/4.png',
  'images/5.png',
  'images/6.png',
  'images/7.png'
];

let dbPromise = null;

/**
 * Initialize or retrieve IndexedDB instance
 */
export function initDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
          store.createIndex('pageNumber', 'pageNumber', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };

      request.onerror = (event) => {
        console.error('IndexedDB init error:', event.target.error);
        reject(event.target.error);
      };
    });
  }
  return dbPromise;
}

/**
 * Fetch all pages sorted by pageNumber.
 * Pre-populates default sequential images (1.png to 7.png) if store is empty.
 */
export async function getAllPages() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = async () => {
      let pages = request.result || [];
      
      // If store is completely empty, populate initial default sequential pages
      if (pages.length === 0) {
        for (let i = 0; i < INITIAL_DEFAULT_PAGES.length; i++) {
          const newPage = {
            pageNumber: i + 1,
            imageData: INITIAL_DEFAULT_PAGES[i],
            fileName: `${i + 1}.png`,
            createdAt: new Date().toISOString()
          };
          store.add(newPage);
        }
        
        // Fetch re-populated list
        const updatedRequest = store.getAll();
        updatedRequest.onsuccess = () => {
          pages = updatedRequest.result || [];
          pages.sort((a, b) => a.pageNumber - b.pageNumber);
          resolve(pages);
        };
        updatedRequest.onerror = (e) => reject(e.target.error);
      } else {
        pages.sort((a, b) => a.pageNumber - b.pageNumber);
        resolve(pages);
      }
    };

    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Add a new page to the diary and wait for transaction completion
 * @param {string} imageData - Base64 Data URL or path of Canva image
 * @param {string} fileName - Original file name
 */
export async function addPage(imageData, fileName = '') {
  const pages = await getAllPages();
  const nextNumber = pages.length + 1;

  const newPage = {
    pageNumber: nextNumber,
    imageData: imageData,
    fileName: fileName,
    createdAt: new Date().toISOString()
  };

  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(newPage);

    request.onsuccess = (event) => {
      newPage.id = event.target.result;
    };

    transaction.oncomplete = () => {
      resolve(newPage);
    };

    transaction.onerror = (event) => {
      console.error('IndexedDB save page error:', event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Delete a page by ID and resequence page numbers sequentially
 * @param {number} id - Page ID to delete
 */
export async function deletePage(id) {
  const db = await initDB();
  
  // First delete the item
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(event.target.error);
  });

  // Fetch remaining pages and renumber sequentially
  const remainingPages = await getAllPages();
  if (remainingPages.length === 0) return [];

  const updateTransaction = db.transaction(STORE_NAME, 'readwrite');
  const store = updateTransaction.objectStore(STORE_NAME);

  remainingPages.forEach((page, index) => {
    page.pageNumber = index + 1;
    store.put(page);
  });

  return new Promise((resolve, reject) => {
    updateTransaction.oncomplete = () => resolve(remainingPages);
    updateTransaction.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Update the order of pages given an array of page IDs
 * @param {Array<number>} orderedIds 
 */
export async function reorderPages(orderedIds) {
  const pages = await getAllPages();
  const pageMap = new Map(pages.map(p => [p.id, p]));
  
  const updatedPages = [];
  orderedIds.forEach((id, index) => {
    const page = pageMap.get(id);
    if (page) {
      page.pageNumber = index + 1;
      updatedPages.push(page);
    }
  });

  const db = await initDB();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  updatedPages.forEach(page => {
    store.put(page);
  });

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve(updatedPages);
    transaction.onerror = (event) => reject(event.target.error);
  });
}
