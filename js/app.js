/**
 * Main Application Logic for Our Little Diary
 * Wires together IndexedDB, DiaryViewer, file uploads, page management, modal dialogs, and Passcode Protection.
 */

import { getAllPages, addPage, deletePage, reorderPages } from './db.js';
import { DiaryViewer } from './viewer.js';

const PASSCODE_KEY = 'diary_passcode';
const DEFAULT_PASSCODE = '8080';

function getStoredPasscode() {
  return localStorage.getItem(PASSCODE_KEY) || DEFAULT_PASSCODE;
}

function setStoredPasscode(newPin) {
  localStorage.setItem(PASSCODE_KEY, newPin);
}

document.addEventListener('DOMContentLoaded', async () => {
  // Screens
  const coverScreen = document.getElementById('cover-screen');
  const diaryScreen = document.getElementById('diary-screen');
  
  // Cover Elements & Passcode Protection
  const openDiaryBtn = document.getElementById('open-diary-btn');
  const passcodeInput = document.getElementById('passcode-input');
  const passcodeError = document.getElementById('passcode-error');
  const passcodeSection = document.querySelector('.passcode-section');
  const changePasscodeBtn = document.getElementById('change-passcode-btn');
  const coverLink = document.getElementById('cover-link');

  // Main UI Elements
  const addPageBtn = document.getElementById('add-page-btn');
  const emptyAddBtn = document.getElementById('empty-add-btn');
  const fileInput = document.getElementById('file-input');
  
  const viewerContainer = document.getElementById('viewer-container');
  const canvaImg = document.getElementById('canva-image');
  const emptyState = document.getElementById('empty-state');
  
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const pageCounter = document.getElementById('page-counter');
  
  const moveLeftBtn = document.getElementById('move-left-btn');
  const moveRightBtn = document.getElementById('move-right-btn');
  const deleteBtn = document.getElementById('delete-btn');

  // Modal Elements
  const managePagesBtn = document.getElementById('manage-pages-btn');
  const manageModal = document.getElementById('manage-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const reorderGrid = document.getElementById('reorder-grid');

  // Initialize Viewer Component
  const viewer = new DiaryViewer({
    containerEl: viewerContainer,
    imgEl: canvaImg,
    emptyStateEl: emptyState,
    prevBtn: prevBtn,
    nextBtn: nextBtn,
    pageCounterEl: pageCounter,
    deleteBtn: deleteBtn,
    moveLeftBtn: moveLeftBtn,
    moveRightBtn: moveRightBtn
  });

  // Load initial pages from IndexedDB
  let pages = await getAllPages();
  viewer.setPages(pages);

  // =========================================================================
  // PASSCODE & SCREEN SWITCHING
  // =========================================================================
  function showScreen(screen) {
    coverScreen.classList.remove('active');
    diaryScreen.classList.remove('active');
    screen.classList.add('active');
  }

  function attemptUnlock() {
    const enteredPin = passcodeInput.value.trim();
    const currentPin = getStoredPasscode();

    if (enteredPin === currentPin) {
      passcodeError.textContent = '';
      passcodeInput.value = '';
      showScreen(diaryScreen);
    } else {
      passcodeError.textContent = 'Incorrect passcode. Try again.';
      passcodeSection.classList.remove('shake');
      void passcodeSection.offsetWidth; // Trigger reflow for re-animation
      passcodeSection.classList.add('shake');
      passcodeInput.select();
    }
  }

  openDiaryBtn.addEventListener('click', attemptUnlock);

  passcodeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      attemptUnlock();
    }
  });

  // Lock & Return to Cover
  coverLink.addEventListener('click', () => {
    passcodeInput.value = '';
    passcodeError.textContent = '';
    showScreen(coverScreen);
  });

  // Change Passcode
  changePasscodeBtn.addEventListener('click', () => {
    const currentPin = getStoredPasscode();
    const enteredOld = prompt('Enter your CURRENT Secret PIN:');

    if (enteredOld === null) return; // User cancelled

    if (enteredOld !== currentPin) {
      alert('Incorrect current PIN!');
      return;
    }

    const newPin = prompt('Enter your NEW Secret PIN (e.g. 1234 or a secret phrase):');
    if (!newPin || newPin.trim() === '') {
      alert('PIN cannot be empty!');
      return;
    }

    setStoredPasscode(newPin.trim());
    alert('✅ Passcode successfully updated!');
  });

  // =========================================================================
  // FILE UPLOAD HANDLING
  // =========================================================================
  const triggerUpload = () => fileInput.click();
  addPageBtn.addEventListener('click', triggerUpload);
  emptyAddBtn.addEventListener('click', triggerUpload);

  fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;

    let firstNewIndex = viewer.pages.length;

    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;

      try {
        const dataUrl = await readFileAsDataURL(file);
        await addPage(dataUrl, file.name);
      } catch (err) {
        console.error('Error uploading file:', err);
      }
    }

    // Reset file input value
    fileInput.value = '';

    // Reload pages and navigate to the newly added page
    pages = await getAllPages();
    viewer.setPages(pages, firstNewIndex);
  });

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  }

  // =========================================================================
  // NAVIGATION CONTROLS
  // =========================================================================
  prevBtn.addEventListener('click', () => viewer.prev());
  nextBtn.addEventListener('click', () => viewer.next());

  document.addEventListener('keydown', (e) => {
    // Only process arrow keys if modal is not active and on diary screen
    if (manageModal.classList.contains('active')) return;
    if (!diaryScreen.classList.contains('active')) return;

    if (e.key === 'ArrowLeft') {
      viewer.prev();
    } else if (e.key === 'ArrowRight') {
      viewer.next();
    }
  });

  // =========================================================================
  // PAGE MANAGEMENT: DELETE & MOVE
  // =========================================================================
  deleteBtn.addEventListener('click', async () => {
    const currentPage = viewer.getCurrentPage();
    if (!currentPage) return;

    const formattedNum = String(currentPage.pageNumber).padStart(2, '0');
    const confirmed = confirm(`Are you sure you want to delete Page ${formattedNum}?`);
    
    if (confirmed) {
      const currentIndex = viewer.currentIndex;
      pages = await deletePage(currentPage.id);
      
      const newTargetIndex = Math.min(currentIndex, Math.max(0, pages.length - 1));
      viewer.setPages(pages, newTargetIndex);
    }
  });

  moveLeftBtn.addEventListener('click', async () => {
    const currentIndex = viewer.currentIndex;
    if (currentIndex <= 0) return;

    const currentPages = [...viewer.pages];
    const temp = currentPages[currentIndex];
    currentPages[currentIndex] = currentPages[currentIndex - 1];
    currentPages[currentIndex - 1] = temp;

    const newIdOrder = currentPages.map(p => p.id);
    pages = await reorderPages(newIdOrder);
    viewer.setPages(pages, currentIndex - 1);
  });

  moveRightBtn.addEventListener('click', async () => {
    const currentIndex = viewer.currentIndex;
    if (currentIndex >= viewer.pages.length - 1) return;

    const currentPages = [...viewer.pages];
    const temp = currentPages[currentIndex];
    currentPages[currentIndex] = currentPages[currentIndex + 1];
    currentPages[currentIndex + 1] = temp;

    const newIdOrder = currentPages.map(p => p.id);
    pages = await reorderPages(newIdOrder);
    viewer.setPages(pages, currentIndex + 1);
  });

  // =========================================================================
  // MANAGE / REORDER MODAL
  // =========================================================================
  managePagesBtn.addEventListener('click', () => {
    renderModalGrid();
    manageModal.classList.add('active');
  });

  modalCloseBtn.addEventListener('click', () => {
    manageModal.classList.remove('active');
  });

  manageModal.addEventListener('click', (e) => {
    if (e.target === manageModal) {
      manageModal.classList.remove('active');
    }
  });

  function renderModalGrid() {
    reorderGrid.innerHTML = '';
    
    if (viewer.pages.length === 0) {
      reorderGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">No pages to display.</p>';
      return;
    }

    viewer.pages.forEach((page, index) => {
      const item = document.createElement('div');
      item.className = `reorder-item ${index === viewer.currentIndex ? 'selected' : ''}`;
      
      const formattedNum = String(page.pageNumber).padStart(2, '0');
      
      item.innerHTML = `
        <img class="reorder-thumb" src="${page.imageData}" alt="Thumbnail ${formattedNum}">
        <div class="reorder-label">Page ${formattedNum}</div>
        <div class="reorder-actions">
          <button class="reorder-btn move-left" ${index === 0 ? 'disabled' : ''} title="Move left">←</button>
          <button class="reorder-btn move-right" ${index === viewer.pages.length - 1 ? 'disabled' : ''} title="Move right">→</button>
          <button class="reorder-btn delete-item" title="Delete page" style="color: var(--danger-color);">✕</button>
        </div>
      `;

      // Select page on click
      item.querySelector('.reorder-thumb').addEventListener('click', () => {
        viewer.setPages(viewer.pages, index);
        manageModal.classList.remove('active');
      });

      // Move Left button in modal
      item.querySelector('.move-left').addEventListener('click', async (e) => {
        e.stopPropagation();
        const currentPages = [...viewer.pages];
        const temp = currentPages[index];
        currentPages[index] = currentPages[index - 1];
        currentPages[index - 1] = temp;

        const newIdOrder = currentPages.map(p => p.id);
        pages = await reorderPages(newIdOrder);
        viewer.setPages(pages, index - 1);
        renderModalGrid();
      });

      // Move Right button in modal
      item.querySelector('.move-right').addEventListener('click', async (e) => {
        e.stopPropagation();
        const currentPages = [...viewer.pages];
        const temp = currentPages[index];
        currentPages[index] = currentPages[index + 1];
        currentPages[index + 1] = temp;

        const newIdOrder = currentPages.map(p => p.id);
        pages = await reorderPages(newIdOrder);
        viewer.setPages(pages, index + 1);
        renderModalGrid();
      });

      // Delete button in modal
      item.querySelector('.delete-item').addEventListener('click', async (e) => {
        e.stopPropagation();
        const confirmed = confirm(`Are you sure you want to delete Page ${formattedNum}?`);
        if (confirmed) {
          pages = await deletePage(page.id);
          const newIndex = Math.min(index, Math.max(0, pages.length - 1));
          viewer.setPages(pages, newIndex);
          renderModalGrid();
        }
      });

      reorderGrid.appendChild(item);
    });
  }
});
