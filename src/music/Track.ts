export interface RequestedBy {
  id: string;
  username: string;
}

export interface Track {
  id: string;
  title: string;
  webpageUrl: string;
  thumbnail?: string;
  duration?: number;
  author?: string;
  requestedBy: RequestedBy;
  provider: "youtube";
}
