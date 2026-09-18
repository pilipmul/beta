// ==========================================
// MAP TRANSFORM ENGINE (PERBAIKAN PINCH-ZOOM)
// ==========================================
function initMapControls() {
  const viewport = document.getElementById('viewport');
  if (!viewport) return;

  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    zoomAtPoint(zoomFactor, e.clientX, e.clientY);
  }, { passive: false });

  viewport.addEventListener('mousedown', (e) => {
    if (isPlacingMode || e.button !== 0) return;
    if (e.target.closest('.circle-marker') || e.target.closest('.hse-marker') || e.target.closest('#floating-detail-card')) return;

    isDraggingMap = true;
    startMouseX = e.clientX - panX;
    startMouseY = e.clientY - panY;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDraggingMap) return;
    panX = e.clientX - startMouseX;
    panY = e.clientY - startMouseY;
    requestUpdateMapTransform();
  });

  window.addEventListener('mouseup', () => {
    if (isDraggingMap) {
      isDraggingMap = false;
      clampBoundaries();
    }
  });

  // PENANGANAN TOUCH & PINCH-ZOOM FIX
  viewport.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      isDraggingMap = false;
      initialPinchDistance = getTouchDistance(e.touches);
      initialScale = scale;
    } else if (e.touches.length === 1 && !isPlacingMode) {
      if (e.target.closest('.circle-marker') || e.target.closest('.hse-marker') || e.target.closest('#floating-detail-card')) return;
      isDraggingMap = true;
      startMouseX = e.touches[0].clientX - panX;
      startMouseY = e.touches[0].clientY - panY;
    }
  }, { passive: false });

  viewport.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const currentDist = getTouchDistance(e.touches);
      if (initialPinchDistance && initialPinchDistance > 0) {
        const factor = currentDist / initialPinchDistance;
        const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        
        let targetScale = initialScale * factor;
        targetScale = Math.max(0.05, Math.min(10, targetScale));
        
        // PERBAIKAN: Mengirimkan nilai targetScale langsung dengan flag isAbsoluteFactor = true
        zoomAtPoint(targetScale, centerX, centerY, true);
      }
    } else if (e.touches.length === 1 && isDraggingMap) {
      panX = e.touches[0].clientX - startMouseX;
      panY = e.touches[0].clientY - startMouseY;
      requestUpdateMapTransform();
    }
  }, { passive: false });

  viewport.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) {
      initialPinchDistance = null;
    }
    if (e.touches.length === 0) {
      isDraggingMap = false;
      clampBoundaries();
    }
  });

  viewport.addEventListener('gesturestart', (e) => {
    e.preventDefault();
    initialScale = scale;
  });

  viewport.addEventListener('gesturechange', (e) => {
    e.preventDefault();
    let targetScale = initialScale * e.scale;
    targetScale = Math.max(0.05, Math.min(10, targetScale));
    
    // PERBAIKAN: Mengirimkan nilai targetScale langsung dengan flag isAbsoluteFactor = true
    zoomAtPoint(targetScale, e.clientX, e.clientY, true);
  });

  viewport.addEventListener('gestureend', (e) => {
    e.preventDefault();
    clampBoundaries();
  });

  viewport.addEventListener('click', (e) => {
    if (!isPlacingMode || appMode !== 'edit' || !isSuperAdmin()) return;

    const img = document.getElementById('denah-img');
    if (!img) return;
    const rect = img.getBoundingClientRect();

    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    if (clickX < 0 || clickX > rect.width || clickY < 0 || clickY > rect.height) {
      alert("Silakan klik tepat di dalam area gambar denah.");
      return;
    }

    const xPercent = (clickX / rect.width) * 100;
    const yPercent = (clickY / rect.height) * 100;

    if (activeCategory === 'tenant' && typeof saveTenantCoordinate === 'function') {
      saveTenantCoordinate(selectedTenantNo, xPercent, yPercent);
    } else if (activeCategory === 'hse' && typeof saveHSECoordinate === 'function') {
      saveHSECoordinate(selectedHSENo, xPercent, yPercent);
    }

    cancelPlacement();
  });
}
