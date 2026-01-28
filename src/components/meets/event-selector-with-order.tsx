"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { GripVertical } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface Event {
  id: string;
  name: string;
  eventType: string;
}

interface EventSelectorWithOrderProps {
  swimmingEvents: Event[];
  relayEvents: Event[];
  divingEvents: Event[];
  selectedEventIds: string[];
  onSelectionChange: (eventIds: string[]) => void;
  onOrderChange: (orderedIds: string[]) => void;
  divingIncluded: boolean;
  onDivingIncludedChange: (included: boolean) => void;
}

function SortableSelectedEventItem({ 
  event, 
  onRemove 
}: { 
  event: Event; 
  onRemove: () => void;
}) {
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
      } border-slate-200 transition-all`}
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
      <Checkbox
        checked={true}
        onCheckedChange={() => onRemove()}
      />
    </div>
  );
}

export function EventSelectorWithOrder({
  swimmingEvents,
  relayEvents,
  divingEvents,
  selectedEventIds,
  onSelectionChange,
  onOrderChange,
  divingIncluded,
  onDivingIncludedChange,
}: EventSelectorWithOrderProps) {
  const [orderedSelectedEvents, setOrderedSelectedEvents] = useState<Event[]>([]);
  const [isOrderingMode, setIsOrderingMode] = useState(false);
  const isInitialMount = useRef(true);
  const skipNextSync = useRef(false);
  const lastSyncedOrder = useRef<string[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Get all events map for quick lookup
  const allEventsMap = useMemo(() => {
    const map = new Map<string, Event>();
    [...swimmingEvents, ...relayEvents, ...divingEvents].forEach((e) => {
      map.set(e.id, e);
    });
    return map;
  }, [swimmingEvents, relayEvents, divingEvents]);

  // Create a stable string key from event arrays for dependency tracking
  const eventsKey = useMemo(() => {
    return [...swimmingEvents, ...relayEvents, ...divingEvents]
      .map((e) => e.id)
      .sort()
      .join(',');
  }, [swimmingEvents, relayEvents, divingEvents]);

  // Update ordered events when selection changes
  useEffect(() => {
    const selected = selectedEventIds
      .map((id) => allEventsMap.get(id))
      .filter((e): e is Event => e !== undefined);
    
    // Maintain current order if events are still selected, otherwise add new ones at end
    setOrderedSelectedEvents((prev) => {
      const prevIds = new Set(prev.map((e) => e.id));
      const newIds = new Set(selectedEventIds);
      
      // Keep existing order for events that are still selected
      const kept = prev.filter((e) => newIds.has(e.id));
      // Add newly selected events at the end
      const added = selected.filter((e) => !prevIds.has(e.id));
      
      return [...kept, ...added];
    });
    
    // Mark that we should skip syncing on the next effect run (since this is a selection change)
    skipNextSync.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventIds, eventsKey]);

  // Sync order changes to parent (but not during initial mount or selection changes)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (orderedSelectedEvents.length > 0) {
        lastSyncedOrder.current = orderedSelectedEvents.map((e) => e.id);
      }
      return;
    }
    
    if (skipNextSync.current) {
      skipNextSync.current = false;
      return;
    }
    
    // Only sync if we have events and the order has actually changed
    if (orderedSelectedEvents.length > 0) {
      const currentOrderIds = orderedSelectedEvents.map((e) => e.id);
      
      // Only sync if the order actually changed
      if (JSON.stringify(currentOrderIds) !== JSON.stringify(lastSyncedOrder.current)) {
        lastSyncedOrder.current = currentOrderIds;
        onOrderChange(currentOrderIds);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedSelectedEvents]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      // Mark that we should sync this change (it's a drag operation, not a selection change)
      skipNextSync.current = false;
      setOrderedSelectedEvents((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleEventToggle = (eventId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedEventIds, eventId]);
    } else {
      const newSelection = selectedEventIds.filter((id) => id !== eventId);
      onSelectionChange(newSelection);
      // Update order to remove the deselected event
      // Mark that we should skip syncing (selection change will handle it)
      skipNextSync.current = true;
      setOrderedSelectedEvents((prev) => prev.filter((e) => e.id !== eventId));
    }
  };

  const renderEventCheckbox = (event: Event) => (
    <div key={event.id} className="flex items-center space-x-2">
      <Checkbox
        id={`event-${event.id}`}
        checked={selectedEventIds.includes(event.id)}
        onCheckedChange={(checked) => handleEventToggle(event.id, checked as boolean)}
      />
      <Label
        htmlFor={`event-${event.id}`}
        className="text-sm font-normal cursor-pointer"
      >
        {event.name}
      </Label>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select & Order Events</CardTitle>
        <CardDescription>
          Choose which events will be competed and drag to reorder them
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Diving Toggle */}
        <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50">
          <div className="space-y-0.5">
            <Label htmlFor="divingIncluded">Include Diving Events</Label>
            <p className="text-sm text-slate-600">
              Enable diving events in this meet
            </p>
          </div>
          <Switch
            id="divingIncluded"
            checked={divingIncluded}
            onCheckedChange={onDivingIncludedChange}
          />
        </div>

        {/* Event Selection Sections */}
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Swimming Events</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-64 overflow-y-auto border rounded-lg p-4">
              {swimmingEvents.map(renderEventCheckbox)}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Relay Events</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-48 overflow-y-auto border rounded-lg p-4">
              {relayEvents.map(renderEventCheckbox)}
            </div>
          </div>

          {divingIncluded && (
            <div>
              <h3 className="font-semibold mb-2">Diving Events</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-48 overflow-y-auto border rounded-lg p-4">
                {divingEvents.map(renderEventCheckbox)}
              </div>
            </div>
          )}
        </div>

        {/* Selected Events Order */}
        {orderedSelectedEvents.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold">Event Order</h3>
                <p className="text-sm text-slate-600">
                  Drag events to reorder. This order will be used throughout the meet.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="orderingMode" className="text-sm">Ordering Mode</Label>
                <Switch
                  id="orderingMode"
                  checked={isOrderingMode}
                  onCheckedChange={setIsOrderingMode}
                />
              </div>
            </div>

            {isOrderingMode ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={orderedSelectedEvents.map((e) => e.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2 border rounded-lg p-4 bg-slate-50">
                    {orderedSelectedEvents.map((event, index) => (
                      <div key={event.id} className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-500 w-8">
                          {index + 1}.
                        </span>
                        <SortableSelectedEventItem
                          event={event}
                          onRemove={() => handleEventToggle(event.id, false)}
                        />
                      </div>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="space-y-2 border rounded-lg p-4 bg-slate-50 max-h-96 overflow-y-auto">
                {orderedSelectedEvents.map((event, index) => (
                  <div key={event.id} className="flex items-center gap-3 p-2 rounded border border-slate-200 bg-white">
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
                    <Checkbox
                      checked={true}
                      onCheckedChange={() => handleEventToggle(event.id, false)}
                      className="ml-auto"
                    />
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-500 mt-2">
              {isOrderingMode 
                ? "💡 Drag events by the grip icon to reorder them"
                : "💡 Enable 'Ordering Mode' to drag and drop events"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
