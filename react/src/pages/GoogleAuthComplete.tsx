import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout, Spin, Alert, Typography } from 'antd';
import { useAuth } from '../features/auth/context/AuthContext';
import { resolveHomeRoute } from '../features/auth/utils/resolveHomeRoute';

const { Content } = Layout;
const { Text } = Typography;

/**
 * Google sign-in finishes with a full-page redirect from the backend (OAuth can't
 * hand data back to the SPA directly), landing here. The auth cookie is already set
 * by then — this page just reads it via /me and forwards to the right dashboard.
 */
const GoogleAuthComplete = () => {
    const navigate = useNavigate();
    const { refresh } = useAuth();
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        refresh().then((user) => {
            if (cancelled) return;
            if (user) {
                navigate(resolveHomeRoute(user), { replace: true });
            } else {
                setFailed(true);
            }
        });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <Layout style={{ minHeight: '100vh', background: 'var(--color-background)' }}>
            <Content style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                {failed ? (
                    <Alert
                        type="error"
                        showIcon
                        message="Something went wrong signing you in with Google."
                        action={
                            <Text style={{ color: '#5D79BB', cursor: 'pointer' }} onClick={() => navigate('/login')}>
                                Back to login
                            </Text>
                        }
                    />
                ) : (
                    <>
                        <Spin size="large" />
                        <Text style={{ color: 'var(--color-muted)' }}>Finishing sign-in...</Text>
                    </>
                )}
            </Content>
        </Layout>
    );
};

export default GoogleAuthComplete;
