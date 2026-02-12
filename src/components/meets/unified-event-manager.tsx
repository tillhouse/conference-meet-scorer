"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GripVertical, ChevronUp, ChevronDown, Trash2, Plus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Event {
  id: string;
  name: string;
  eventType: "individual" | "relay" | "diving";
}

interface UnifiedEventManagerProps {
  allStandardEvents: Event[];
  configuredEvents: Event[];
  onEventsChange: (events: Event[]) => void;
  onOrderChange: (orderedIds: string[]) => void;
  /** Number of meet days (1-5). When > 1, shows day selector per event. */
  durationDays?: number;
  /** Map eventId -> day (1-based). Used when durationDays > 1. */
  eventDays?: Record<string, number>;
  onEventDaysChange?: (eventDays: Record<string, number>) => void;
  divingIncluded: boolean;
  onDivingIncludedChange?: (included: boolean) => void;
}

function SortableEventItem({
  event,
  index,
  totalEvents,
  day,
  durationDays,
  onDayChange,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  event: Event;
  index: number;
  totalEvents: number;
  day?: number;
  durationDays?: number;
  onDayChange?: (eventId: string, day: number) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
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
        return "bg-gray-800 text-white";
      case "relay":
        return "bg-blue-100 text-blue-800";
      case "diving":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200 ${
        isDragging ? "shadow-lg z-50" : ""
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
      >
        <GripVertical className="h-5 w-5" />
      </div>
      <span className="text-sm font-medium text-gray-600 w-8">
        {index + 1}.
      </span>
      <span className="flex-1 font-medium text-gray-900">{event.name}</span>
      <Badge className={getEventTypeColor(event.eventType)}>
        {event.eventType}
      </Badge>
      {durationDays != null && durationDays >= 1 && onDayChange && (
        <Select
          value={(day ?? 1).toString()}
          onValueChange={(value) => onDayChange(event.id, parseInt(value, 10))}
        >
          <SelectTrigger className="w-[100px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: durationDays }, (_, i) => i + 1).map((d) => (
              <SelectItem key={d} value={d.toString()}>
                Day {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onMoveUp}
          disabled={index === 0}
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onMoveDown}
          disabled={index === totalEvents - 1}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function UnifiedEventManager({
  allStandardEvents,
  configuredEvents,
  onEventsChange,
  onOrderChange,
  durationDays = 1,
  eventDays = {},
  onEventDaysChange,
  divingIncluded,
  onDivingIncludedChange,
}: UnifiedEventManagerProps) {
  const [activeTab, setActiveTab] = useState<"standard" | "custom">("standard");
  const [customEventName, setCustomEventName] = useState("");
  const [customEventType, setCustomEventType] = useState<"individual" | "relay" | "diving">("individual");
  const [orderedEvents, setOrderedEvents] = useState<Event[]>(configuredEvents);
  const isInitialMount = useRef(true);
  const skipNextSync = useRef(false);
  const lastSyncedOrder = useRef<string[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Update ordered events when configured events change
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      setOrderedEvents(configuredEvents);
      if (configuredEvents.length > 0) {
        lastSyncedOrder.current = configuredEvents.map((e) => e.id);
      }
      return;
    }

    // Maintain order for existing events, add new ones at the end
    setOrderedEvents((prev) => {
      const prevIds = new Set(prev.map((e) => e.id));
      const newIds = new Set(configuredEvents.map((e) => e.id));
      
      // Keep existing order for events that are still configured
      const kept = prev.filter((e) => newIds.has(e.id));
      // Add newly configured events at the end
      const added = configuredEvents.filter((e) => !prevIds.has(e.id));
      
      return [...kept, ...added];
    });
    
    skipNextSync.current = true;
  }, [configuredEvents]);

  // Sync order changes to parent
  useEffect(() => {
    if (isInitialMount.current) {
      return;
    }
    
    if (skipNextSync.current) {
      skipNextSync.current = false;
      return;
    }
    
    if (orderedEvents.length > 0) {
      const currentOrderIds = orderedEvents.map((e) => e.id);
      
      if (JSON.stringify(currentOrderIds) !== JSON.stringify(lastSyncedOrder.current)) {
        lastSyncedOrder.current = currentOrderIds;
        onOrderChange(currentOrderIds);
      }
    }
  }, [orderedEvents, onOrderChange]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      skipNextSync.current = false;
      setOrderedEvents((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return;
    skipNextSync.current = false;
    setOrderedEvents((items) => {
      const newItems = [...items];
      [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
      return newItems;
    });
  }, []);

  const handleMoveDown = useCallback((index: number) => {
    if (index === orderedEvents.length - 1) return;
    skipNextSync.current = false;
    setOrderedEvents((items) => {
      const newItems = [...items];
      [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
      return newItems;
    });
  }, [orderedEvents.length]);

  const handleDelete = useCallback((eventId: string) => {
    skipNextSync.current = true;
    const updatedEvents = orderedEvents.filter((e) => e.id !== eventId);
    setOrderedEvents(updatedEvents);
    onEventsChange(updatedEvents);
  }, [orderedEvents, onEventsChange]);

  // Get available standard events (not already configured)
  const availableStandardEvents = useMemo(() => {
    const configuredIds = new Set(configuredEvents.map((e) => e.id));
    return allStandardEvents.filter((e) => {
      // Filter out diving events if diving is not included
      if (e.eventType === "diving" && !divingIncluded) {
        return false;
      }
      return !configuredIds.has(e.id);
    });
  }, [allStandardEvents, configuredEvents, divingIncluded]);

  const handleAddStandardEvent = useCallback((eventId: string) => {
    const eventToAdd = allStandardEvents.find((e) => e.id === eventId);
    if (eventToAdd) {
      skipNextSync.current = true;
      const updatedEvents = [...configuredEvents, eventToAdd];
      onEventsChange(updatedEvents);
    }
  }, [allStandardEvents, configuredEvents, onEventsChange]);

  const handleAddCustomEvent = useCallback(() => {
    if (!customEventName.trim()) {
      return;
    }

    const newEvent: Event = {
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: customEventName.trim(),
      eventType: customEventType,
    };

    skipNextSync.current = true;
    const updatedEvents = [...configuredEvents, newEvent];
    onEventsChange(updatedEvents);
    
    // Reset form
    setCustomEventName("");
    setCustomEventType("individual");
  }, [customEventName, customEventType, configuredEvents, onEventsChange]);

  const allStandardAdded = availableStandardEvents.length === 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Events</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              {configuredEvents.length} event{configuredEvents.length !== 1 ? "s" : ""} configured
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "standard" | "custom")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="standard">Standard Events</TabsTrigger>
            <TabsTrigger value="custom">Custom Event</TabsTrigger>
          </TabsList>

          <TabsContent value="standard" className="space-y-4">
            <div className="flex gap-2">
              <Select
                value=""
                onValueChange={handleAddStandardEvent}
                disabled={allStandardAdded}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={allStandardAdded ? "All standard events added" : "Select a standard event to add..."} />
                </SelectTrigger>
                <SelectContent>
                  {availableStandardEvents.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.name} ({event.eventType})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {allStandardAdded && (
              <p className="text-sm text-gray-600">
                All {allStandardEvents.length} standard events are in your lineup.
              </p>
            )}
          </TabsContent>

          <TabsContent value="custom" className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Event name (e.g., 150 Free SCY)"
                value={customEventName}
                onChange={(e) => setCustomEventName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustomEvent();
                  }
                }}
                className="flex-1"
              />
              <Select
                value={customEventType}
                onValueChange={(v) => setCustomEventType(v as "individual" | "relay" | "diving")}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="relay">Relay</SelectItem>
                  <SelectItem value="diving">Diving</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleAddCustomEvent} disabled={!customEventName.trim()}>
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* Configured Events List */}
        {orderedEvents.length > 0 && (
          <div className="space-y-2">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={orderedEvents.map((e) => e.id)}
                strategy={verticalListSortingStrategy}
              >
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-2">
                    {orderedEvents.map((event, index) => (
                      <SortableEventItem
                        key={event.id}
                        event={event}
                        index={index}
                        totalEvents={orderedEvents.length}
                        day={eventDays[event.id] ?? 1}
                        durationDays={durationDays}
                        onDayChange={onEventDaysChange ? (eventId, day) => {
                          onEventDaysChange({ ...eventDays, [eventId]: day });
                        } : undefined}
                        onMoveUp={() => handleMoveUp(index)}
                        onMoveDown={() => handleMoveDown(index)}
                        onDelete={() => handleDelete(event.id)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </SortableContext>
            </DndContext>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
