"use client";

import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GripVertical, Save, X } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface Event {
  id: string;
  name: string;
  eventType: string;
}

interface EventOrderEditorProps {
  meetId: string;
  events: Event[];
  currentOrder: string[] | null;
}

function SortableEventItem({ event, isActive }: { event: Event; isActive: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: event.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getEventTypeColor = (eventType: string) => {
    switch (eventType) {
      case "individual":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "relay":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "diving":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-lg border-2 bg-white ${
        isDragging ? "shadow-lg" : "shadow-sm"
      } ${isActive ? "border-blue-500" : "border-slate-200"} transition-all`}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600"
      >
        <GripVertical className="h-5 w-5" />
      </div>
      <div className="flex-1 flex items-center gap-3">
        <Badge variant="outline" className={getEventTypeColor(event.eventType)}>
          {event.eventType}
        </Badge>
        <span className="font-medium text-slate-900">{event.name}</span>
      </div>
    </div>
  );
}

export function EventOrderEditor({
  meetId,
  events,
  currentOrder,
}: EventOrderEditorProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [orderedEvents, setOrderedEvents] = useState<Event[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Initialize ordered events based on current order or default order
  // Includes all event types: individual (swimming), relay, and diving
  useEffect(() => {
    if (currentOrder && currentOrder.length > 0) {
      // Use custom order
      const ordered = currentOrder
        .map((id) => events.find((e) => e.id === id))
        .filter((e): e is Event => e !== undefined);
      // Add any events not in the custom order at the end (including any missing relays)
      const remaining = events.filter((e) => !currentOrder.includes(e.id));
      setOrderedEvents([...ordered, ...remaining]);
    } else {
      // Use default order (by name for now, could use Event.sortOrder)
      // This includes all event types: individual, relay, and diving
      setOrderedEvents([...events].sort((a, b) => a.name.localeCompare(b.name)));
    }
  }, [events, currentOrder]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setOrderedEvents((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const eventIds = orderedEvents.map((e) => e.id);
      const response = await fetch(`/api/meets/${meetId}/event-order`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ eventOrder: eventIds }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to save event order");
      }

      toast.success("Event order saved successfully!");
      setIsEditing(false);
      // Refresh the page to get updated data
      router.refresh();
    } catch (error: any) {
      console.error("Error saving event order:", error);
      toast.error(error.message || "Failed to save event order");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset to original order
    if (currentOrder && currentOrder.length > 0) {
      const ordered = currentOrder
        .map((id) => events.find((e) => e.id === id))
        .filter((e): e is Event => e !== undefined);
      const remaining = events.filter((e) => !currentOrder.includes(e.id));
      setOrderedEvents([...ordered, ...remaining]);
    } else {
      setOrderedEvents([...events].sort((a, b) => a.name.localeCompare(b.name)));
    }
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Event Order</CardTitle>
              <CardDescription>
                {currentOrder
                  ? "Events are displayed in custom order (includes individual, relay, and diving events)"
                  : "Events are displayed in default order (includes individual, relay, and diving events)"}
              </CardDescription>
            </div>
            <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
              Edit Order
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {orderedEvents.map((event, index) => (
              <div
                key={event.id}
                className="flex items-center gap-3 p-2 rounded border border-slate-200 bg-slate-50"
              >
                <span className="text-sm font-medium text-slate-500 w-8">
                  {index + 1}.
                </span>
                <Badge
                  variant="outline"
                  className={
                    event.eventType === "individual"
                      ? "bg-blue-100 text-blue-800 border-blue-200"
                      : event.eventType === "relay"
                      ? "bg-purple-100 text-purple-800 border-purple-200"
                      : "bg-green-100 text-green-800 border-green-200"
                  }
                >
                  {event.eventType}
                </Badge>
                <span className="text-sm font-medium">{event.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-blue-500">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Edit Event Order</CardTitle>
            <CardDescription>
              Drag and drop events to reorder them. This order will be used throughout the meet. Includes all event types: individual swimming, relays, and diving.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleCancel}
              variant="outline"
              size="sm"
              disabled={isSaving}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave} size="sm" disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save Order"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={orderedEvents.map((e) => e.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {orderedEvents.map((event) => (
                <SortableEventItem key={event.id} event={event} isActive={true} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <p className="text-xs text-slate-500 mt-4">
          💡 Tip: Drag events by the grip icon to reorder them
        </p>
      </CardContent>
    </Card>
  );
}
