import { useEffect, useState } from 'react';
import floorPlanImage from '../assets/Reception Seat Diagram.png';
import './FloorPlan.css';

interface FloorPlanProps {
  tableNumber: string;
}

// Table positions (x, y as percentages of image dimensions)
// Measured from the floor plan image
const tablePositions: Record<string, { x: number; y: number }> = {
  // Left side tables (top to bottom, left to right)
  '53': { x: 16, y: 11 },
  '23': { x: 26, y: 11 },
  '21': { x: 36, y: 11 },

  '51': { x: 16, y: 19 },
  '25': { x: 26, y: 19 },
  '19': { x: 36, y: 19 },

  '49': { x: 16, y: 27 },
  '27': { x: 26, y: 27 },
  '17': { x: 36, y: 27 },

  '47': { x: 16, y: 35 },
  '29': { x: 26, y: 35 },
  '15': { x: 36, y: 35 },

  '45': { x: 16, y: 43 },
  '31': { x: 26, y: 43 },
  '13': { x: 36, y: 43 },

  '43': { x: 16, y: 51 },
  '33': { x: 26, y: 51 },
  '11': { x: 36, y: 51 },

  '41': { x: 16, y: 59 },
  '35': { x: 26, y: 59 },
  '9': { x: 36, y: 59 },

  '39': { x: 16, y: 67 },
  '37': { x: 26, y: 67 },
  '7': { x: 36, y: 67 },

  // Right side tables (top to bottom, left to right)
  '22': { x: 64, y: 11 },
  '24': { x: 74, y: 11 },
  '54': { x: 84, y: 11 },

  '20': { x: 64, y: 19 },
  '26': { x: 74, y: 19 },
  '52': { x: 84, y: 19 },

  '18': { x: 64, y: 27 },
  '28': { x: 74, y: 27 },
  '50': { x: 84, y: 27 },

  '16': { x: 64, y: 35 },
  '30': { x: 74, y: 35 },
  '48': { x: 84, y: 35 },

  '14': { x: 64, y: 43 },
  '32': { x: 74, y: 43 },
  '46': { x: 84, y: 43 },

  '12': { x: 64, y: 51 },
  '34': { x: 74, y: 51 },
  '44': { x: 84, y: 51 },

  '10': { x: 64, y: 59 },
  '36': { x: 74, y: 59 },
  '42': { x: 84, y: 59 },

  '8': { x: 64, y: 67 },
  '38': { x: 74, y: 67 },
  '40': { x: 84, y: 67 },

  // Side sections
  '1': { x: 43, y: 42 },
  '3': { x: 43, y: 50 },
  '5': { x: 43, y: 58 },
  '2': { x: 57, y: 42 },
  '4': { x: 57, y: 50 },
  '6': { x: 57, y: 58 },
};

export default function FloorPlan({ tableNumber }: FloorPlanProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const position = tablePositions[tableNumber];

  useEffect(() => {
    const img = new Image();
    img.src = floorPlanImage;
    img.onload = () => setImageLoaded(true);
  }, []);

  return (
    <div className="floor-plan-container">
      <div className="floor-plan-header">
        <h3>You're seated at Table {tableNumber}</h3>
      </div>

      <div className="floor-plan-wrapper">
        <img
          src={floorPlanImage}
          alt="Reception Floor Plan"
          className="floor-plan-image"
          onLoad={() => setImageLoaded(true)}
        />

        {imageLoaded && position && (
          <>
            <div
              className="table-highlight pulse"
              style={{
                left: `${position.x}%`,
                top: `${position.y}%`,
              }}
            />
            <div
              className="table-highlight-ring"
              style={{
                left: `${position.x}%`,
                top: `${position.y}%`,
              }}
            />
          </>
        )}
      </div>

      <div className="floor-plan-legend">
        <p>Look for the pulsing red circle to find your table</p>
      </div>
    </div>
  );
}
