import { useEffect, useState } from 'react';
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
  const position = config.tablePositions[tableNumber];

  useEffect(() => {
    const img = new Image();
    img.src = floorPlanImageSrc;
    img.onload = () => {
      setImageLoaded(true);
    };
  }, []);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setImageWidth(e.currentTarget.offsetWidth);
    setImageLoaded(true);
  };

  // Calculate scaling factor based on displayed image width vs original width
  const scaleFactor = imageWidth / config.canvasWidth;

  return (
    <div className="floor-plan-container">
      <div className="floor-plan-header">
        <h3>You're seated at Table {tableNumber}</h3>
      </div>

      <div className="canvas-container">
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
        <p>Look for the pulsing red circle to find your table</p>
      </div>
    </div>
  );
}
