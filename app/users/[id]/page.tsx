"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Card, Input, Modal, Space, Typography } from "antd";
import { useAuthSession } from "@/hooks/useAuthSession";

export default function ProfilePage() {
  const router = useRouter();
  const { loaded, isAuthenticated } = useAuthSession();
  const params = useParams<{ id: string }>();
  const [editPasswordOpen, setEditPasswordOpen] = useState<boolean>(false);

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
      <Card className="screen-card" title={`User Profile: ${params.id}`}>
        <Typography.Paragraph className="muted-text">
          Minimal skeleton route. Final profile fields come from API.
        </Typography.Paragraph>

        <Space direction="vertical" style={{ width: "100%" }}>
          <Button
            type="primary"
            className="full-width-button"
            onClick={() => setEditPasswordOpen(true)}
          >
            Edit Password
          </Button>
          <Button
            className="full-width-button"
            onClick={() => router.push("/menu")}
          >
            Back to Menu
          </Button>
        </Space>
      </Card>

      <Modal
        title="Overlay edit password"
        open={editPasswordOpen}
        onCancel={() => setEditPasswordOpen(false)}
        footer={[
          <Button
            key="close"
            type="primary"
            onClick={() => setEditPasswordOpen(false)}
          >
            Save
          </Button>,
        ]}
      >
        <Input.Password placeholder="New password" />
      </Modal>
    </div>
  );
}
