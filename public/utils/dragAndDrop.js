class DragAndDropManager {
    constructor(options = {}) {
        this.containerSelector = options.containerSelector || '.draggable-container';
        this.itemSelector = options.itemSelector || '.draggable-item';
        this.onReorder = options.onReorder || (() => {});
        this.draggedItemClass = options.draggedItemClass || 'opacity-50';
    }

    init() {
        const container = document.querySelector(this.containerSelector);
        if (!container) return;

        container.addEventListener('dragstart', this.handleDragStart.bind(this));
        container.addEventListener('dragover', this.handleDragOver.bind(this));
        container.addEventListener('drop', this.handleDrop.bind(this));
    }

    handleDragStart(e) {
        const item = e.target.closest(this.itemSelector);
        if (!item) return;

        e.dataTransfer.setData('text/plain', item.dataset.index);
        item.classList.add(this.draggedItemClass);
    }

    handleDragOver(e) {
        e.preventDefault();
    }

    async handleDrop(e) {
        e.preventDefault();
        const item = e.target.closest(this.itemSelector);
        if (!item) return;

        const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'));
        const targetIndex = parseInt(item.dataset.index);

        // Remove opacity from dragged element
        document.querySelector(`${this.itemSelector}[data-index="${sourceIndex}"]`)
            ?.classList.remove(this.draggedItemClass);

        if (sourceIndex === targetIndex) return;

        try {
            await this.onReorder(sourceIndex, targetIndex);
        } catch (error) {
            console.error('Error during reorder:', error);
            throw error;
        }
    }

    destroy() {
        const container = document.querySelector(this.containerSelector);
        if (!container) return;

        container.removeEventListener('dragstart', this.handleDragStart);
        container.removeEventListener('dragover', this.handleDragOver);
        container.removeEventListener('drop', this.handleDrop);
    }
}

export { DragAndDropManager };
