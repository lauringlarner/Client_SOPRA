"use client";

import React, { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Card, Space, Typography } from "antd";
import { useAuthSession } from "@/hooks/useAuthSession";

export default function LeaderboardPage() {
  const router = useRouter();
  const { loaded, isAuthenticated } = useAuthSession();
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId;

  useEffect(() => {
    if (!loaded) return;
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, loaded, router]);

  if (!loaded || !isAuthenticated) {
    return <div className="screen-root" />;
  }

  return (
    <div className="screen-root">
      <Card
        className="screen-card"
        title={`End of Game / Leaderboard: ${gameId}`}
      >
        <Typography.Paragraph className="screen-footnote">
          Minimal skeleton route. Final leaderboard list comes from API.
        </Typography.Paragraph>

        <Space direction="vertical" style={{ width: "100%" }}>
          <Button
            type="primary"
            className="full-width-button"
            onClick={() => router.push("/menu")}
          >
            Back to Menu
          </Button>
          <Button
            className="full-width-button"
            onClick={() => router.push(`/games/${gameId}`)}
          >
            Back to Board
          </Button>
        </Space>
      </Card>
    </div>
  );
}
