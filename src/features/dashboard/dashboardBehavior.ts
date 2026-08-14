export function shouldAutoRequestLocationWeather(autoWeather: boolean, locationWeatherEnabled: boolean) {
  return autoWeather && locationWeatherEnabled;
}

export function dashboardGreeting(greeting: string, name: string) {
  const normalizedGreeting = greeting.replace(/\.$/, '');
  const normalizedName = name.trim();

  if (!normalizedName) {
    return {
      firstLine: `${normalizedGreeting}.`,
      secondLine: undefined,
    };
  }

  return {
    firstLine: `${normalizedGreeting},`,
    secondLine: `${normalizedName}.`,
  };
}

export function shouldShowNotificationDot(hasUnreadNotifications: boolean) {
  return hasUnreadNotifications;
}
