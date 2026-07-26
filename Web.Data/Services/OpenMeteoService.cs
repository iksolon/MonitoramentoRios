namespace Web.Data.Services;

using Simple.API;
using Simple.API.ClientBuilderAttributes;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Threading.Tasks;

public class OpenMeteoService
{
    private readonly IOpenMeteoApi api;
    public OpenMeteoService()
    {
        api = ClientBuilder.Create<IOpenMeteoApi>("https://api.open-meteo.com/");
    }

    public async Task<OpenMeteoResultDTO> ObterPrevisaoLocalidade(LocalidadeBusca localidade)
    {
        var r = await api.GetForecast(
                       localidade.Lat.ToString(CultureInfo.InvariantCulture),
                       localidade.Lon.ToString(CultureInfo.InvariantCulture),
                       string.Join(',', [
                           "temperature_2m",
                            "precipitation","precipitation_probability",
                            "surface_pressure",
                            "cloud_cover","cloud_cover_low","cloud_cover_mid","cloud_cover_high",
                            "weather_code","visibility",
                            "wind_speed_10m","wind_direction_10m","wind_gusts_10m",
                            "is_day","uv_index",
                            "apparent_temperature","relative_humidity_2m"
                       ]),
                       7);
        r.EnsureSuccessStatusCode();

        return r.Data;
    }
}

interface IOpenMeteoApi
{
    [Get("v1/forecast?latitude={latitude}&longitude={longitude}&hourly={list}&past_days=0&forecast_days={days}")]
    public Task<Response<OpenMeteoResultDTO>> GetForecast([InRoute] string latitude, [InRoute] string longitude, [InRoute] string list, [InRoute] int days);
}

public class OpenMeteoResultDTO
{
    public float latitude { get; set; }
    public float longitude { get; set; }
    public float generationtime_ms { get; set; }
    public int utc_offset_seconds { get; set; }
    public string timezone { get; set; }
    public string timezone_abbreviation { get; set; }
    public float elevation { get; set; }
    public Hourly_Units hourly_units { get; set; }
    public Hourly hourly { get; set; }

    public class Hourly_Units
    {
        public string time { get; set; }
        public string temperature_2m { get; set; }
        public string precipitation { get; set; }
        public string surface_pressure { get; set; }
        public string cloud_cover { get; set; }
        public string cloud_cover_low { get; set; }
        public string cloud_cover_mid { get; set; }
        public string cloud_cover_high { get; set; }
        public string weather_code { get; set; }
        public string visibility { get; set; }
        public string wind_speed_10m { get; set; }
        public string wind_direction_10m { get; set; }
        public string wind_gusts_10m { get; set; }
        public string is_day { get; set; }
        public string uv_index { get; set; }
        public string apparent_temperature { get; set; }
        public string relative_humidity_2m { get; set; }
    }

    public class Hourly
    {
        public DateTime[] time { get; set; }
        public int[] weather_code { get; set; }
        public decimal[] temperature_2m { get; set; }
        public decimal[] precipitation { get; set; }
        public decimal[] precipitation_probability { get; set; }
        public decimal[] surface_pressure { get; set; }
        public decimal[] cloud_cover { get; set; }
        public decimal[] cloud_cover_low { get; set; }
        public decimal[] cloud_cover_mid { get; set; }
        public decimal[] cloud_cover_high { get; set; }
        public decimal[] visibility { get; set; }
        public decimal[] wind_speed_10m { get; set; }
        public decimal[] wind_direction_10m { get; set; }
        public decimal[] wind_gusts_10m { get; set; }
        public decimal[] is_day { get; set; }
        public decimal[] uv_index { get; set; }
        public decimal[] apparent_temperature { get; set; }
        public decimal[] relative_humidity_2m { get; set; }
    }

}
