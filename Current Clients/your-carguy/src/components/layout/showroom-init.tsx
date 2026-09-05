"use client";

import { useEffect } from "react";
import { initShowroom } from "@/lib/showroom";

export default function ShowroomInit() {
  useEffect(() => {
    initShowroom();
  }, []);
  
  return null;
}