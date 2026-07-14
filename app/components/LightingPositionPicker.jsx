import React, { useCallback, useRef, useState } from "react";
import {
  createLightingMarker,
  normalizeMarkers,
} from "../services/placement/index.js";
import { MAX_PLACEMENT_MARKERS_V1 } from "../services/placement/constants.js";

/**
 * Compact lighting-position picker for the simplified UX.
 * Markers use lighting icons (not map pins).
 * Parent owns ✅ تم / 🗑️ مسح النقاط actions.
 */
export default function LightingPositionPicker({
  imageSrc,
  markers = [],
  onChange,
  enabled = false,
  maxMarkers = MAX_PLACEMENT_MARKERS_V1,
  markerIcon = "🤖",
  getMarkerIcon,
}) {
  const containerRef = useRef(null);
  const dragRef = useRef(null);
  const [selectedId, setSelectedId] = useState(null);

  const emit = useCallback(
    (next) => {
      if (typeof onChange === "function") {
        onChange(normalizeMarkers(next));
      }
    },
    [onChange],
  );

  const clientToPercent = useCallback((clientX, clientY) => {
    const el = containerRef.current;
    if (!el) {
      return { x: 0, y: 0 };
    }
    const rect = el.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return { x, y };
  }, []);

  const handleImageClick = (event) => {
    if (!enabled) {
      return;
    }
    if (dragRef.current?.moved) {
      dragRef.current = null;
      return;
    }
    if (markers.length >= maxMarkers) {
      return;
    }

    const { x, y } = clientToPercent(event.clientX, event.clientY);
    const marker = createLightingMarker(x, y);
    emit([...markers, marker]);
    setSelectedId(marker.id);
  };

  const handlePointerDown = (event, markerId) => {
    if (!enabled) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(markerId);
    dragRef.current = {
      id: markerId,
      moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (!enabled || !dragRef.current?.id) {
      return;
    }
    event.preventDefault();
    dragRef.current.moved = true;
    const { x, y } = clientToPercent(event.clientX, event.clientY);
    emit(
      markers.map((marker) =>
        marker.id === dragRef.current.id
          ? { ...marker, x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) }
          : marker,
      ),
    );
  };

  const handlePointerUp = (event) => {
    if (!dragRef.current) {
      return;
    }
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setTimeout(() => {
      dragRef.current = null;
    }, 0);
  };

  const deleteMarker = (markerId) => {
    emit(markers.filter((marker) => marker.id !== markerId));
    if (selectedId === markerId) {
      setSelectedId(null);
    }
  };

  return (
    <div style={{ marginTop: "8px" }}>
      <div
        ref={containerRef}
        onClick={handleImageClick}
        onPointerMove={handlePointerMove}
        style={{
          position: "relative",
          display: "block",
          width: "100%",
          maxWidth: "560px",
          margin: "0 auto",
          cursor: enabled ? "crosshair" : "default",
          userSelect: "none",
          touchAction: enabled ? "none" : "auto",
        }}
      >
        <img
          src={imageSrc}
          alt="الغرفة"
          draggable={false}
          decoding="async"
          fetchPriority="high"
          style={{
            display: "block",
            width: "100%",
            borderRadius: "14px",
            pointerEvents: "none",
          }}
        />

        {markers.map((marker, index) => {
          const number = index + 1;
          const isSelected = marker.id === selectedId;
          const icon =
            typeof getMarkerIcon === "function"
              ? getMarkerIcon(marker, index)
              : markerIcon;

          return (
            <button
              key={marker.id}
              type="button"
              aria-label={`Lighting position ${number}`}
              title="اسحب للنقل · انقر مرتين للحذف"
              onPointerDown={(event) => handlePointerDown(event, marker.id)}
              onPointerUp={handlePointerUp}
              onClick={(event) => {
                event.stopPropagation();
                setSelectedId(marker.id);
              }}
              onDoubleClick={(event) => {
                event.stopPropagation();
                if (enabled) {
                  deleteMarker(marker.id);
                }
              }}
              style={{
                position: "absolute",
                left: `${marker.x}%`,
                top: `${marker.y}%`,
                transform: "translate(-50%, -50%)",
                width: isSelected ? "42px" : "38px",
                height: isSelected ? "42px" : "38px",
                borderRadius: "50%",
                border: isSelected
                  ? "2px solid #1a1a1a"
                  : "2px solid rgba(255,255,255,0.95)",
                background:
                  "radial-gradient(circle at 35% 30%, #fff8e7 0%, #f5e6c8 45%, #e8d4a8 100%)",
                color: "#1a1a1a",
                fontSize: isSelected ? "18px" : "16px",
                cursor: enabled ? "grab" : "default",
                boxShadow: isSelected
                  ? "0 4px 14px rgba(0,0,0,0.35)"
                  : "0 2px 10px rgba(0,0,0,0.28)",
                zIndex: isSelected ? 3 : 2,
                padding: 0,
                lineHeight: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span aria-hidden="true">{icon}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
