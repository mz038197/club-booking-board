from pydantic import BaseModel, Field


class SlotIn(BaseModel):
    date: str
    start: str
    end: str
    room: str


class SlotsReplaceRequest(BaseModel):
    slots: list[SlotIn]


class BoardSlot(BaseModel):
    slot_id: str
    date: str
    start: str
    end: str
    room: str
    status: str
    booked_by: str | None = None

    def to_public(self) -> dict:
        data = self.model_dump(exclude_none=True)
        return data


class BoardResponse(BaseModel):
    slots: list[BoardSlot]


class BookingCreateRequest(BaseModel):
    slot_id: str
    student_id: str


class BookingResponse(BaseModel):
    booking_id: str
    slot_id: str
    student_id: str


class PosterCopyRequest(BaseModel):
    title: str
    time: str
    place: str
    notes: str | None = Field(default=None)


class PosterCopyResponse(BaseModel):
    title: str
    time_place: str
    slogan: str
    body: str
