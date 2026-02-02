import { useEffect, useState, useCallback } from 'react';
import './FloorPlan.css';
import floorPlanConfig from '../config/floorPlan.json';
// Import floor plan image - update this import when changing the floor plan image
import floorPlanImageSrc from '../assets/Reception Seat Diagram.png';

interface FloorPlanProps {
  tableNumber: string;
}

interface TablePosition {
  x: number;
  y: number;
}

interface FloorPlanConfig {
  imageFileName: string;
  canvasWidth: number;
  canvasHeight: number;
  tablePositions: Record<string, TablePosition>;
}

const config: FloorPlanConfig = floorPlanConfig;

export default function FloorPlan({ tableNumber }: FloorPlanProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageWidth, setImageWidth] = useState(0);
  const [isEnlarged, setIsEnlarged] = useState(false);
  const [enlargedDimensions, setEnlargedDimensions] = useState({ width: 0, height: 0, offsetX: 0, offsetY: 0 });
  const position = config.tablePositions[tableNumber];
  const hasValidPosition = Boolean(position);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setImageWidth(e.currentTarget.offsetWidth);
    setImageLoaded(true);
  };

  const handleEnlargedImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const containerWidth = img.parentElement?.offsetWidth || 0;
    const containerHeight = img.parentElement?.offsetHeight || 0;

    // Calculate actual displayed dimensions with object-fit: contain
    const imageAspect = config.canvasWidth / config.canvasHeight;
    const containerAspect = containerWidth / containerHeight;

    let displayWidth, displayHeight, offsetX, offsetY;

    if (imageAspect > containerAspect) {
      // Image is wider - constrained by width
      displayWidth = containerWidth;
      displayHeight = containerWidth / imageAspect;
      offsetX = 0;
      offsetY = (containerHeight - displayHeight) / 2;
    } else {
      // Image is taller - constrained by height
      displayHeight = containerHeight;
      displayWidth = containerHeight * imageAspect;
      offsetX = (containerWidth - displayWidth) / 2;
      offsetY = 0;
    }

    setEnlargedDimensions({ width: displayWidth, height: displayHeight, offsetX, offsetY });
  };

  const handleEnlarge = () => {
    setIsEnlarged(true);
  };

  const handleClose = useCallback(() => {
    setIsEnlarged(false);
  }, []);

  // Handle escape key to close enlarged view
  useEffect(() => {
    if (!isEnlarged) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isEnlarged, handleClose]);

  // Calculate scaling factor based on displayed image width vs original width
  const scaleFactor = imageWidth / config.canvasWidth;
  const enlargedScaleFactor = enlargedDimensions.width / config.canvasWidth;

  return (
    <>
      <div className="floor-plan-container">
        <div className="floor-plan-header">
          <h3>You're seated at Table {tableNumber}</h3>
        </div>

        <div className="canvas-container" onClick={handleEnlarge} style={{ cursor: 'pointer' }}>
          <img
            src={floorPlanImageSrc}
            alt="Reception Floor Plan"
            className="floor-plan-image"
            onLoad={handleImageLoad}
          />

          {imageLoaded && position && scaleFactor > 0 && (
            <div
              className="point-marker"
              data-table-id={tableNumber}
              style={{
                left: `${position.x * scaleFactor}px`,
                top: `${position.y * scaleFactor}px`,
              }}
            >
              <div className="point-pulse" />
            </div>
          )}
        </div>

        <div className="floor-plan-legend">
          {hasValidPosition ? (
            <p>Click map to enlarge • Look for the pulsing red circle</p>
          ) : (
            <p className="floor-plan-warning">Table location not mapped - please ask staff for assistance</p>
          )}
        </div>
      </div>

      {isEnlarged && (
        <div className="floor-plan-enlarged-overlay" onClick={handleClose}>
          <div className="floor-plan-enlarged-content" onClick={(e) => e.stopPropagation()}>
            <button className="floor-plan-close-button" onClick={handleClose}>
              &times;
            </button>
            <div className="floor-plan-enlarged-header">
              <h3>Table {tableNumber}</h3>
            </div>
            <div className="canvas-container-enlarged">
              <img
                src={floorPlanImageSrc}
                alt="Reception Floor Plan - Enlarged"
                className="floor-plan-image-enlarged"
                onLoad={handleEnlargedImageLoad}
              />

              {imageLoaded && position && enlargedScaleFactor > 0 && (
                <div
                  className="point-marker"
                  data-table-id={tableNumber}
                  style={{
                    left: `${enlargedDimensions.offsetX + (position.x * enlargedScaleFactor)}px`,
                    top: `${enlargedDimensions.offsetY + (position.y * enlargedScaleFactor)}px`,
                  }}
                >
                  <div className="point-pulse" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
