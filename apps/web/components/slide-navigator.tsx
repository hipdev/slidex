"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useMemo, useState } from "react";
import type { Doc, Id } from "@slidex/backend/data-model";

import { tr } from "../i18n/provider";

type SlideNavigatorProps = {
  slides: Doc<"slides">[];
  currentSlideId?: Id<"slides">;
  isHost: boolean;
  onCreate: () => void;
  onSelect: (slideId: Id<"slides">) => void;
  onReorder: (slideIds: Id<"slides">[]) => Promise<void>;
};

type ThumbProps = {
  slide: Doc<"slides">;
  index: number;
  active: boolean;
  draggable: boolean;
  onSelect: () => void;
};

function Thumb({ slide, index, active, draggable, onSelect }: ThumbProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: slide._id,
    disabled: !draggable,
    transition: { duration: 180, easing: "cubic-bezier(.455,.03,.515,.955)" },
  });

  return <button
    ref={setNodeRef}
    type="button"
    disabled={!draggable}
    onClick={onSelect}
    className={`thumb ${active ? "active" : ""} ${isDragging ? "is-dragging" : ""}`}
    style={{ transform: CSS.Transform.toString(transform), transition }}
    {...attributes}
    {...listeners}
  >
    <span>{String(index + 1).padStart(2, "0")}</span><b>{slide.title}</b><em>{tr(`kind.${slide.kind}`)}</em>
  </button>;
}

function OverlayThumb({ slide, index }: { slide: Doc<"slides">; index: number }) {
  return <div className="thumb slide-drag-overlay" aria-hidden="true">
    <span>{String(index + 1).padStart(2, "0")}</span><b>{slide.title}</b><em>{tr(`kind.${slide.kind}`)}</em>
  </div>;
}

export function SlideNavigator({ slides, currentSlideId, isHost, onCreate, onSelect, onReorder }: SlideNavigatorProps) {
  const [order, setOrder] = useState(() => slides.map((slide) => slide._id));
  const [activeId, setActiveId] = useState<Id<"slides"> | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    const incomingIds = slides.map((slide) => slide._id);
    setOrder((current) => current.length === incomingIds.length && current.every((id) => incomingIds.includes(id)) ? current : incomingIds);
  }, [slides]);

  const orderedSlides = useMemo(() => {
    const byId = new Map(slides.map((slide) => [slide._id, slide]));
    return order.map((id) => byId.get(id)).filter((slide): slide is Doc<"slides"> => Boolean(slide));
  }, [order, slides]);
  const activeSlide = activeId ? orderedSlides.find((slide) => slide._id === activeId) : undefined;

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(active.id as Id<"slides">);
    const newIndex = order.indexOf(over.id as Id<"slides">);
    if (oldIndex < 0 || newIndex < 0) return;
    const nextOrder = arrayMove(order, oldIndex, newIndex);
    setOrder(nextOrder);
    try {
      await onReorder(nextOrder);
    } catch {
      setOrder(slides.map((slide) => slide._id));
    }
  };

  return <aside className="navigator">
    <div className="nav-heading"><span>{tr("DECK /")} {slides.length.toString().padStart(2, "0")}</span>{isHost && <small>Drag to reorder</small>}</div>
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={({ active }) => setActiveId(active.id as Id<"slides">)}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <div className="slide-sort-list">
          {orderedSlides.map((slide, index) => <Thumb key={slide._id} slide={slide} index={index} active={slide._id === currentSlideId} draggable={isHost} onSelect={() => onSelect(slide._id)} />)}
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(.32,.72,0,1)" }}>
        {activeSlide && <OverlayThumb slide={activeSlide} index={orderedSlides.indexOf(activeSlide)} />}
      </DragOverlay>
    </DndContext>
    {isHost && <button className="add-slide" onClick={onCreate} disabled={slides.length >= 50}><span aria-hidden="true">+</span>{tr("Crear slide")}<small>{tr(slides.length >= 50 ? "Máximo de 50 slides" : "Tu siguiente idea")}</small></button>}
  </aside>;
}
