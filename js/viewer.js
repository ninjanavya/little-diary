/**
 * Viewer module for Digital Diary
 * Controls active page index, image rendering, navigation button states, and page indicators.
 */

export class DiaryViewer {
  constructor(options) {
    this.containerEl = options.containerEl;
    this.imgEl = options.imgEl;
    this.emptyStateEl = options.emptyStateEl;
    this.prevBtn = options.prevBtn;
    this.nextBtn = options.nextBtn;
    this.pageCounterEl = options.pageCounterEl;
    this.deleteBtn = options.deleteBtn;
    this.moveLeftBtn = options.moveLeftBtn;
    this.moveRightBtn = options.moveRightBtn;

    this.pages = [];
    this.currentIndex = 0;

    this.onPageChange = options.onPageChange || (() => {});
  }

  /**
   * Helper to format numbers like 1 -> "01", 12 -> "12"
   */
  formatPageNum(num) {
    return String(num).padStart(2, '0');
  }

  /**
   * Set pages data and refresh display
   * @param {Array} pages 
   * @param {number|null} targetIndex 
   */
  setPages(pages, targetIndex = null) {
    this.pages = pages || [];
    
    if (this.pages.length === 0) {
      this.currentIndex = 0;
    } else if (targetIndex !== null && targetIndex >= 0 && targetIndex < this.pages.length) {
      this.currentIndex = targetIndex;
    } else if (this.currentIndex >= this.pages.length) {
      this.currentIndex = Math.max(0, this.pages.length - 1);
    }

    this.render();
  }

  /**
   * Render the current active page
   */
  render() {
    const total = this.pages.length;

    if (total === 0) {
      // Empty state
      if (this.containerEl) this.containerEl.style.display = 'none';
      if (this.emptyStateEl) this.emptyStateEl.style.display = 'flex';
      
      if (this.pageCounterEl) this.pageCounterEl.textContent = 'Page 00 / 00';
      if (this.prevBtn) this.prevBtn.disabled = true;
      if (this.nextBtn) this.nextBtn.disabled = true;
      if (this.deleteBtn) this.deleteBtn.disabled = true;
      if (this.moveLeftBtn) this.moveLeftBtn.disabled = true;
      if (this.moveRightBtn) this.moveRightBtn.disabled = true;
      return;
    }

    // Has pages
    if (this.emptyStateEl) this.emptyStateEl.style.display = 'none';
    if (this.containerEl) this.containerEl.style.display = 'flex';

    const currentPage = this.pages[this.currentIndex];
    
    if (this.imgEl) {
      this.imgEl.src = currentPage.imageData;
      this.imgEl.alt = `Diary Page ${this.formatPageNum(currentPage.pageNumber)}`;
    }

    // Update Counter: Page 01 / 06
    const formattedCurrent = this.formatPageNum(this.currentIndex + 1);
    const formattedTotal = this.formatPageNum(total);
    if (this.pageCounterEl) {
      this.pageCounterEl.textContent = `Page ${formattedCurrent} / ${formattedTotal}`;
    }

    // Update Navigation buttons state
    if (this.prevBtn) this.prevBtn.disabled = (this.currentIndex === 0);
    if (this.nextBtn) this.nextBtn.disabled = (this.currentIndex === total - 1);

    // Update Reorder buttons state
    if (this.moveLeftBtn) this.moveLeftBtn.disabled = (this.currentIndex === 0);
    if (this.moveRightBtn) this.moveRightBtn.disabled = (this.currentIndex === total - 1);
    if (this.deleteBtn) this.deleteBtn.disabled = false;

    this.onPageChange(currentPage, this.currentIndex, total);
  }

  /**
   * Go to previous page
   */
  prev() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.render();
    }
  }

  /**
   * Go to next page
   */
  next() {
    if (this.currentIndex < this.pages.length - 1) {
      this.currentIndex++;
      this.render();
    }
  }

  /**
   * Get current active page
   */
  getCurrentPage() {
    return this.pages[this.currentIndex] || null;
  }
}
