import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { confirmSignIn } from "aws-amplify/auth";
import { useAuth } from "@/hooks/useAuth";

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function IndexNew() {
  const [username, setUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [_error, setError] = useState("");
  
  const { isAuthenticated, nextStep, login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    setError("")

    try {
      if (nextStep === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") {
        // Confirm challenge / new password
        await confirmSignIn({ challengeResponse: newPassword });
        // Login
        await login(username, currentPassword);
      } else {
        // Login
        await login(username, currentPassword);
        // Redirect to the app's main page or dashboard
        navigate("/dashboard");
      }
    } catch (err: any) {
      console.log(err)
      setError(err.message)
    }
  }

  if (isAuthenticated) {
    // Redirect to the profile page
    return <Navigate to="/dashboard" />
  }
  return (
    <div className="flex h-screen w-full">
      {/* Left column - can be used for branding or imagery */}
      <div className="hidden w-1/2 bg-pink-500 lg:flex lg:items-center lg:justify-end lg:pr-8">
        <div className="text-6xl font-bold text-white">OwnStats</div>
      </div>

      {/* Right column with centered login form */}
      <div className="flex w-full items-center justify-center px-4 lg:w-1/2">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-2xl">Login</CardTitle>
            <CardDescription>
              Enter your email and password below to login to your instance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4">
                {!nextStep && (
                  <>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      placeholder="Email"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      type="email"
                      autoComplete="email"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <div className="flex items-center">
                      <Label htmlFor="password">Password</Label>
                    </div>
                    <Input 
                      id="current-password"
                      type="password"
                      placeholder="Password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                    />
                  </div>
                </>
              )}
              {nextStep && nextStep === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED" && (
                <div className="grid gap-2">
                  <div className="flex items-center">
                    <Label htmlFor="password">Password</Label>
                  </div>
                  <Input 
                    id="new-password"
                    type="password"
                    placeholder="Password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>
              )}
                <Button type="submit" className="w-full">
                  {nextStep && nextStep === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED" ? "Update password" : "Sign in"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}