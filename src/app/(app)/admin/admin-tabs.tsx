"use client";

import { useState } from "react";
import { Building2, MapPin, Users } from "lucide-react";

import { PlatformUserItem } from "@/actions/users";
import { PlaceTypeAdminItem } from "@/actions/place-types";
import { PlaceTypeManager } from "../sa/place-type-manager";
import { AdminOrgItem, OrganizationsTable } from "./organizations-table";
import { PlatformUserTable } from "./platform-user-table";

type AdminTabsProps = {
  initialTab?: string;
  allUsers: PlatformUserItem[];
  allOrganizations: AdminOrgItem[];
  placeTypesList: PlaceTypeAdminItem[];
  currentUserId: string;
};

export function AdminTabs({
  initialTab = "users",
  allUsers,
  allOrganizations,
  placeTypesList,
  currentUserId,
}: AdminTabsProps) {
  const [activeTab, setActiveTab] = useState<"users" | "organizations" | "places">(() => {
    if (initialTab === "organizations" || initialTab === "places") {
      return initialTab;
    }
    return "users";
  });

  function switchTab(tab: "users" | "organizations" | "places") {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url.toString());
  }

  return (
    <div className="space-y-6">
      {/* Mobile-Optimized Segmented Tab Navigation */}
      <div className="flex items-center gap-1.5 p-1 bg-muted/60 dark:bg-muted/40 rounded-xl border border-border/70 overflow-x-auto scrollbar-none w-full">
        <button
          type="button"
          onClick={() => switchTab("users")}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all active:scale-[0.97] cursor-pointer whitespace-nowrap ${
            activeTab === "users"
              ? "bg-card text-foreground shadow-xs font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-card/50"
          }`}
        >
          <Users className="size-3.5 sm:size-4 shrink-0" />
          <span>Users</span>
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] sm:text-xs font-mono font-medium ${
              activeTab === "users"
                ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {allUsers.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => switchTab("organizations")}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all active:scale-[0.97] cursor-pointer whitespace-nowrap ${
            activeTab === "organizations"
              ? "bg-card text-foreground shadow-xs font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-card/50"
          }`}
        >
          <Building2 className="size-3.5 sm:size-4 shrink-0" />
          <span>Organizations</span>
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] sm:text-xs font-mono font-medium ${
              activeTab === "organizations"
                ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {allOrganizations.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => switchTab("places")}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all active:scale-[0.97] cursor-pointer whitespace-nowrap ${
            activeTab === "places"
              ? "bg-card text-foreground shadow-xs font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-card/50"
          }`}
        >
          <MapPin className="size-3.5 sm:size-4 shrink-0" />
          <span>Place Types</span>
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] sm:text-xs font-mono font-medium ${
              activeTab === "places"
                ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {placeTypesList.length}
          </span>
        </button>
      </div>

      {/* Tab Content Panes */}
      <div>
        {activeTab === "users" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Platform Users Directory</h2>
                <p className="text-xs text-muted-foreground">
                  View and manage designations, organization memberships, and account permissions.
                </p>
              </div>
            </div>
            <PlatformUserTable
              initialUsers={allUsers}
              currentUserId={currentUserId}
            />
          </div>
        )}

        {activeTab === "organizations" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Organizations Directory</h2>
                <p className="text-xs text-muted-foreground">
                  Workspaces, timezones, and membership counts across the platform.
                </p>
              </div>
            </div>
            <OrganizationsTable organizations={allOrganizations} />
          </div>
        )}

        {activeTab === "places" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Global Place Kinds</h2>
                <p className="text-xs text-muted-foreground">
                  Categories available when adding places to organizations.
                </p>
              </div>
            </div>
            <PlaceTypeManager initialPlaceTypes={placeTypesList} />
          </div>
        )}
      </div>
    </div>
  );
}

